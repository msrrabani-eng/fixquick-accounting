#include <jni.h>
#include "llama.h"
#include <algorithm>
#include <atomic>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <vector>

static std::atomic<bool> cancelled{false};
static std::mutex generation;
static std::once_flag backend;
static bool abort_decode(void *) { return cancelled.load(); }
static bool model_progress(float, void *) { return !cancelled.load(); }
static std::string bytes(JNIEnv *e, jbyteArray a) {
    std::string s(e->GetArrayLength(a), '\0');
    e->GetByteArrayRegion(a,0,s.size(),reinterpret_cast<jbyte*>(s.data())); return s;
}
extern "C" JNIEXPORT void JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeCancel(JNIEnv*, jclass) { cancelled=true; }
extern "C" JNIEXPORT void JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeResetCancel(JNIEnv*, jclass) { cancelled=false; }
extern "C" JNIEXPORT jbyteArray JNICALL Java_ir_fixquick_accounting_LocalAIPlugin_nativeGenerate(JNIEnv *e,jclass,jbyteArray path,jbyteArray input,jint limit,jint threads,jint context_limit) {
    std::lock_guard<std::mutex> lock(generation);
    try {
        std::call_once(backend, []{llama_backend_init();});
        if(cancelled) throw std::runtime_error("Cancelled");
        auto mp=llama_model_default_params(); mp.n_gpu_layers=0; mp.use_mmap=true; mp.use_mlock=false; mp.progress_callback=model_progress;
        std::unique_ptr<llama_model,decltype(&llama_model_free)> model(llama_model_load_from_file(bytes(e,path).c_str(),mp),llama_model_free);
        if(!model)throw std::runtime_error("Model could not load; check memory or cancel state");
        const auto *vocab=llama_model_get_vocab(model.get());
        const auto prompt=bytes(e,input); const int n=-llama_tokenize(vocab,prompt.data(),prompt.size(),nullptr,0,false,true);
        limit=std::clamp(limit,16,768);
        const int cap=context_limit>=4096?4096:2048;
        if(n<=0||n+limit>=cap)throw std::runtime_error("Conversation too long for available memory; start a new conversation");
        const int needed=std::max(1024,((n+limit+512)/512)*512);
        auto cp=llama_context_default_params(); cp.n_ctx=needed; cp.n_batch=128; cp.n_ubatch=64; cp.n_threads=std::clamp((int)threads,1,6); cp.n_threads_batch=cp.n_threads; cp.abort_callback=abort_decode;
        std::unique_ptr<llama_context,decltype(&llama_free)> ctx(llama_init_from_model(model.get(),cp),llama_free);
        if(!ctx)throw std::runtime_error("Not enough RAM for inference context");
        std::vector<llama_token> tokens(n); if(llama_tokenize(vocab,prompt.data(),prompt.size(),tokens.data(),n,false,true)!=n)throw std::runtime_error("Tokenization failed");
        std::unique_ptr<llama_sampler,decltype(&llama_sampler_free)> sampler(llama_sampler_init_greedy(),llama_sampler_free);
        for(int i=0;i<n;i+=128){if(cancelled||llama_decode(ctx.get(),llama_batch_get_one(tokens.data()+i,std::min(128,n-i))))throw std::runtime_error("Prompt evaluation interrupted");}
        std::string out;
        for(int i=0;i<limit&&!cancelled;i++){
            llama_token t=llama_sampler_sample(sampler.get(),ctx.get(),-1);
            if(llama_vocab_is_eog(vocab,t))break;
            std::vector<char> buf(128); int k=llama_token_to_piece(vocab,t,buf.data(),buf.size(),0,false);
            if(k<0){buf.resize(-k);k=llama_token_to_piece(vocab,t,buf.data(),buf.size(),0,false);}
            if(k<0)throw std::runtime_error("Token decoding failed");out.append(buf.data(),k);
            if(llama_decode(ctx.get(),llama_batch_get_one(&t,1)))throw std::runtime_error("Generation interrupted");
        }
        if(cancelled)throw std::runtime_error("Cancelled");
        jbyteArray result=e->NewByteArray(out.size());if(result)e->SetByteArrayRegion(result,0,out.size(),reinterpret_cast<const jbyte*>(out.data()));return result;
    }catch(const std::exception& x){ e->ThrowNew(e->FindClass("java/lang/IllegalStateException"),x.what());return nullptr; }
}
