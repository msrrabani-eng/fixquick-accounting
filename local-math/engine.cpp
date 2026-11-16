#include <jni.h>
#include <llama.h>
#include <algorithm>
#include <atomic>
#include <memory>
#include <string>
#include <vector>
#include <stdexcept>
#include <mutex>
#include <chrono>

static std::atomic<bool> cancelled{false};
static std::atomic<int> stage{0},percent{0},generated{0};
static std::once_flag backend;
using Clock=std::chrono::steady_clock;
struct Limits {Clock::time_point until;};
static bool stop(void *p) {
    return cancelled.load() || Clock::now() > static_cast<Limits*>(p)->until;
}
static bool progress(float value,void *p){percent=std::max(0,std::min(100,int(value*100)));return !stop(p);}
static std::string bytes(JNIEnv *e,jbyteArray a) {
    if(!a)throw std::runtime_error("Missing input");
    std::string s(e->GetArrayLength(a),'\0');
    e->GetByteArrayRegion(a,0,s.size(),reinterpret_cast<jbyte*>(s.data()));
    return s;
}
extern "C" JNIEXPORT void JNICALL Java_ir_fixquick_accounting_FqMathService_nativeStop(JNIEnv*,jclass) {cancelled=true;}
extern "C" JNIEXPORT void JNICALL Java_ir_fixquick_accounting_FqMathService_nativeReset(JNIEnv*,jclass) {cancelled=false;stage=1;percent=0;generated=0;}
extern "C" JNIEXPORT jint JNICALL Java_ir_fixquick_accounting_FqMathService_nativeStage(JNIEnv*,jclass){return stage.load();}
extern "C" JNIEXPORT jint JNICALL Java_ir_fixquick_accounting_FqMathService_nativePercent(JNIEnv*,jclass){return percent.load();}
extern "C" JNIEXPORT jint JNICALL Java_ir_fixquick_accounting_FqMathService_nativeTokens(JNIEnv*,jclass){return generated.load();}
extern "C" JNIEXPORT jbyteArray JNICALL Java_ir_fixquick_accounting_FqMathService_nativeRun(JNIEnv *e,jclass,jbyteArray path,jbyteArray prompt,jint maximum) {
    try {
        Limits limits{Clock::now()+std::chrono::seconds(175)};
        std::call_once(backend,[]{llama_backend_init();});
        auto mp=llama_model_default_params();mp.n_gpu_layers=0;mp.load_mode=LLAMA_LOAD_MODE_MMAP;mp.progress_callback=progress;mp.progress_callback_user_data=&limits;
        auto file=bytes(e,path),input=bytes(e,prompt);
        std::unique_ptr<llama_model,decltype(&llama_model_free)> model(llama_model_load_from_file(file.c_str(),mp),llama_model_free);
        if(!model||stop(&limits))throw std::runtime_error("Model load failed or cancelled; check RAM");
        stage=2;const bool probe=maximum<=24;
        auto cp=llama_context_default_params();cp.n_ctx=probe?512:3072;cp.n_batch=probe?64:256;cp.n_ubatch=probe?64:128;cp.n_threads=4;cp.n_threads_batch=4;
        std::unique_ptr<llama_context,decltype(&llama_free)> ctx(llama_init_from_model(model.get(),cp),llama_free);
        if(!ctx)throw std::runtime_error("Could not allocate inference context");
        llama_set_abort_callback(ctx.get(),stop,&limits);
        stage=3;auto vocab=llama_model_get_vocab(model.get());
        int count=llama_tokenize(vocab,input.data(),input.size(),nullptr,0,false,true);
        if(count>=0||count < -2400)throw std::runtime_error("Prompt exceeds local context");
        std::vector<llama_token> tokens(-count);
        count=llama_tokenize(vocab,input.data(),input.size(),tokens.data(),tokens.size(),false,true);
        if(count<=0)throw std::runtime_error("Prompt tokenization failed");
        int budget=std::min({int(maximum),640,int(cp.n_ctx)-count-8});
        if(budget<1)throw std::runtime_error("Insufficient context");
        percent=0;
        const int chunk=probe?4:32;
        for(int i=0;i<count;i+=chunk) {
            const int batch=std::min(chunk,count-i);
            if(stop(&limits)||llama_decode(ctx.get(),llama_batch_get_one(tokens.data()+i,batch))!=0)throw std::runtime_error("Prompt evaluation interrupted");
            percent=(i+batch)*100/count;
        }
        std::unique_ptr<llama_sampler,decltype(&llama_sampler_free)> sampler(llama_sampler_init_greedy(),llama_sampler_free);
        if(!sampler)throw std::runtime_error("Sampler allocation failed");
        stage=4;generated=0;std::string out;bool ended=false;
        for(int i=0;i<budget;i++) {
            if(stop(&limits))throw std::runtime_error("Inference cancelled or timed out");
            auto token=llama_sampler_sample(sampler.get(),ctx.get(),-1);
            if(llama_vocab_is_eog(vocab,token)){ended=true;break;}
            char buf[512];int n=llama_token_to_piece(vocab,token,buf,sizeof(buf),0,false);
            if(n<0||n>int(sizeof(buf)))throw std::runtime_error("Token decoding failed");
            out.append(buf,n);generated=i+1;
            if(i+1<budget&&llama_decode(ctx.get(),llama_batch_get_one(&token,1))!=0)throw std::runtime_error("Generation interrupted");
        }
        if(out.empty())throw std::runtime_error("Model returned empty answer");
        if(!ended)out+="\n[output limit]";
        jbyteArray result=e->NewByteArray(out.size());if(result)e->SetByteArrayRegion(result,0,out.size(),reinterpret_cast<const jbyte*>(out.data()));return result;
    } catch(const std::exception &x) {
        auto type=e->FindClass("java/lang/IllegalStateException");if(type)e->ThrowNew(type,x.what());return nullptr;
    }
}
