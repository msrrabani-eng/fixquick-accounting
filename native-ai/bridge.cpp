#include <jni.h>
#include "llama.h"
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cctype>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

using Clock=std::chrono::steady_clock;
static long long now_ms(){return std::chrono::duration_cast<std::chrono::milliseconds>(Clock::now().time_since_epoch()).count();}
// Phase and counters are atomics: status polling must never wait for inference lock.
static std::atomic<bool> cancelled{false};
static std::atomic<long long> started{0}, deadline{0};
static std::atomic<int> phase{0}, processed{0}, total{0}, output_tokens{0};
static std::mutex generation;
static std::once_flag backend;
static bool timed_out(){const auto d=deadline.load();return d>0&&now_ms()>=d;}
static bool abort_decode(void *) { return cancelled.load()||timed_out(); }
static bool model_progress(float p, void *) {processed=std::clamp((int)(p*100),0,100);return !abort_decode(nullptr);}
static void stage(int p,int t=0){processed=0;total=t;phase=p;}
static void check_stop(){if(cancelled)throw std::runtime_error("Cancelled");if(timed_out())throw std::runtime_error("Inference deadline reached");}
// Stop after a single completed top-level JSON object, not after arbitrary token
// limit. Quoted braces and escaped quotation marks are ignored. JS still parses it.
static bool complete_json(const std::string &s){
    bool seen=false, quoted=false, escaped=false;int depth=0;
    for(unsigned char c:s){
        if(!seen){if(std::isspace(c))continue;if(c!='{')return false;seen=true;depth=1;continue;}
        if(quoted){if(escaped)escaped=false;else if(c=='\\')escaped=true;else if(c=='"')quoted=false;continue;}
        if(c=='"')quoted=true;else if(c=='{')++depth;else if(c=='}'&&--depth==0)return true;
    }return false;
}
// Only the verified weights are cached; contexts, prompt and generated tokens are
// always destroyed after each call. Java schedules disposal on the idle worker.
using ModelPtr=std::unique_ptr<llama_model,decltype(&llama_model_free)>;
static ModelPtr cached_model(nullptr,llama_model_free);
static std::string cached_path;
static void release_model(){cached_model.reset();cached_path.clear();}
extern "C" JNIEXPORT void JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeReleaseModel(JNIEnv*,jclass){std::lock_guard<std::mutex> lock(generation);release_model();}
extern "C" JNIEXPORT jlongArray JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeProgress(JNIEnv* e,jclass){
    const auto t=started.load();jlong v[]={phase.load(),processed.load(),total.load(),t?now_ms()-t:0,output_tokens.load(),cancelled.load()?1:0,timed_out()?1:0};
    jlongArray a=e->NewLongArray(7);if(a)e->SetLongArrayRegion(a,0,7,v);return a;
}
static std::string bytes(JNIEnv *e, jbyteArray a) {
    std::string s(e->GetArrayLength(a), '\0');
    e->GetByteArrayRegion(a,0,s.size(),reinterpret_cast<jbyte*>(s.data())); return s;
}
extern "C" JNIEXPORT void JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeCancel(JNIEnv*, jclass) { cancelled=true; }
extern "C" JNIEXPORT void JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeResetCancel(JNIEnv*, jclass) { cancelled=false; started=0; deadline=0; output_tokens=0; stage(1); }
extern "C" JNIEXPORT jbyteArray JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeGenerate(JNIEnv *e,jclass,jbyteArray path,jbyteArray input,jint limit,jint threads,jint timeout_ms,jint context_limit) {
    std::lock_guard<std::mutex> lock(generation);
    try {
        started=now_ms();deadline=started.load()+std::clamp((int)timeout_ms,1000,360000);output_tokens=0;check_stop();
        std::call_once(backend, []{llama_backend_init();});check_stop();
        auto mp=llama_model_default_params(); mp.n_gpu_layers=0; mp.use_mmap=true; mp.use_mlock=false; mp.progress_callback=model_progress;
        const auto filename=bytes(e,path);
        if(!cached_model||cached_path!=filename){release_model();stage(2,100);cached_model.reset(llama_model_load_from_file(filename.c_str(),mp));check_stop();if(!cached_model)throw std::runtime_error("Model could not load");cached_path=filename;}
        stage(3);check_stop();
        const auto *vocab=llama_model_get_vocab(cached_model.get());
        const auto prompt=bytes(e,input); const int n=-llama_tokenize(vocab,prompt.data(),prompt.size(),nullptr,0,false,true);
        limit=std::clamp(limit,16,768);
        const int cap=context_limit>=4096?4096:2048;
        if(n<=0||n+limit>=cap)throw std::runtime_error("Conversation too long for available memory; start a new conversation");
        const int needed=std::min(cap,std::max(1024,((n+limit+511)/512)*512));
        auto cp=llama_context_default_params(); cp.n_ctx=needed; cp.n_batch=128; cp.n_ubatch=64; cp.n_threads=std::clamp((int)threads,1,6); cp.n_threads_batch=cp.n_threads; cp.abort_callback=abort_decode;
        std::unique_ptr<llama_context,decltype(&llama_free)> ctx(llama_init_from_model(cached_model.get(),cp),llama_free);
        if(!ctx)throw std::runtime_error("Not enough RAM for inference context");
        std::vector<llama_token> tokens(n); if(llama_tokenize(vocab,prompt.data(),prompt.size(),tokens.data(),n,false,true)!=n)throw std::runtime_error("Tokenization failed");
        std::unique_ptr<llama_sampler,decltype(&llama_sampler_free)> sampler(llama_sampler_init_greedy(),llama_sampler_free);
        stage(4,n);
        for(int i=0;i<n;i+=128){check_stop();const int count=std::min(128,n-i);const int rc=llama_decode(ctx.get(),llama_batch_get_one(tokens.data()+i,count));check_stop();if(rc)throw std::runtime_error("Prompt evaluation interrupted");processed=i+count;}
        stage(5,limit);
        std::string out;
        for(int i=0;i<limit;i++){
            check_stop();
            llama_token t=llama_sampler_sample(sampler.get(),ctx.get(),-1);
            if(llama_vocab_is_eog(vocab,t))break;
            std::vector<char> buf(128); int k=llama_token_to_piece(vocab,t,buf.data(),buf.size(),0,false);
            if(k<0){buf.resize(-k);k=llama_token_to_piece(vocab,t,buf.data(),buf.size(),0,false);}
            if(k<0)throw std::runtime_error("Token decoding failed");out.append(buf.data(),k);output_tokens=i+1;processed=i+1;
            if(complete_json(out))break;
            const int rc=llama_decode(ctx.get(),llama_batch_get_one(&t,1));check_stop();if(rc)throw std::runtime_error("Generation interrupted");
        }
        check_stop();stage(6);deadline=0;
        jbyteArray result=e->NewByteArray(out.size());if(result)e->SetByteArrayRegion(result,0,out.size(),reinterpret_cast<const jbyte*>(out.data()));return result;
    }catch(const std::exception& x){ release_model();deadline=0; e->ThrowNew(e->FindClass("java/lang/IllegalStateException"),x.what());return nullptr; }
}
