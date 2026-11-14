package ir.fixquick.accounting;

import android.Manifest;
import android.app.ActivityManager;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.net.URI;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name="FixQuickAI",permissions={@Permission(alias="mic",strings={Manifest.permission.RECORD_AUDIO})})
public class LocalAIPlugin extends Plugin {
    private static final String URL="https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/bc640142c66e1fdd12af0bd68f40445458f3869b/Qwen3-4B-Q4_K_M.gguf";
    private static final String SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5";
    private static final long ESTIMATE=2500000000L, RESERVE=1000000000L, MIN_RAM=AiMemoryPolicy.MIN_RAM;
    private static final String DIR="ai", FILE="Qwen3-4B-Q4_K_M.gguf";
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy=new AtomicBoolean(), verifying=new AtomicBoolean();
    private final Handler main=new Handler(Looper.getMainLooper());
    private volatile String error="";
    private volatile boolean runtime=false;
    private SpeechRecognizer speech;
    private PluginCall voiceCall;
    private TextToSpeech tts;
    private static native byte[] nativeGenerate(byte[] path,byte[] prompt,int maxTokens,int threads,int timeoutMs,int contextLimit);
    private static native long[] nativeProgress();
    private static native void nativeReleaseModel();
    private volatile boolean destroyed=false;
    private final Runnable idleRelease=()->{synchronized(this){if(runtime&&!destroyed)worker.execute(()->{synchronized(this){if(!busy.get()&&!destroyed)nativeReleaseModel();}});}};
    private synchronized void scheduleRelease(){main.removeCallbacks(idleRelease);if(!destroyed)main.postDelayed(idleRelease,15000);}
    private void addProgress(JSObject out){if(!runtime)return;long[] a=nativeProgress();if(a==null||a.length!=7)return;out.put("phase",a[0]);out.put("processed",a[1]);out.put("phaseTotal",a[2]);out.put("elapsedMs",a[3]);out.put("outputTokens",a[4]);out.put("cancelRequested",a[5]!=0);out.put("deadlineReached",a[6]!=0);}

    private static native void nativeCancel();
    private static native void nativeResetCancel();
    @Override public void load(){if(!arm64())return;try{System.loadLibrary("fixquick_ai");runtime=true;}catch(UnsatisfiedLinkError e){runtime=false;}}
    private String lastStage(){long[] a=nativeProgress();if(a==null||a.length!=7)return "";String[] labels={"نامشخص","آماده‌سازی موتور","بارگذاری مدل","آماده‌سازی حافظه و متن","پردازش سؤال","تولید پاسخ","پایان پردازش","خطای موتور"};int i=(int)a[0];return " (مرحله: "+labels[Math.max(0,Math.min(labels.length-1,i))]+"؛ "+(a[3]/1000)+" ثانیه؛ "+a[4]+" توکن خروجی)";}
    private SharedPreferences prefs(){return getContext().getSharedPreferences("fq_ai_model_v1",Context.MODE_PRIVATE);}
    private File model(){File root=getContext().getExternalFilesDir(null);if(root==null)throw new IllegalStateException("Model storage unavailable");File d=new File(root,DIR);if(!d.exists()&&!d.mkdirs())throw new IllegalStateException("Cannot create model storage");return new File(d,FILE);}
    private DownloadManager dm(){return (DownloadManager)getContext().getSystemService(Context.DOWNLOAD_SERVICE);}
    private ActivityManager.MemoryInfo mem(){ActivityManager.MemoryInfo m=new ActivityManager.MemoryInfo();((ActivityManager)getContext().getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(m);return m;}
    private boolean arm64(){for(String a:Build.SUPPORTED_64_BIT_ABIS)if(a.equals("arm64-v8a"))return true;return false;}
    private boolean verified(File f){return f.isFile()&&f.length()>0&&prefs().getString("sha","").equals(SHA)&&prefs().getLong("size",-1)==f.length()&&prefs().getLong("mtime",-1)==f.lastModified();}
    // URL is a mirror of the pinned model only. Never relax the SHA verification.
    private static String sourceUrl(String value){
        if(value==null)return URL;
        String raw=value.trim();
        if(raw.isEmpty()||raw.length()>2048||!raw.regionMatches(true,0,"https://",0,8))throw new IllegalArgumentException("آدرس HTTPS معتبر لازم است.");
        try{
            URI u=new URI(raw);
            if(!"https".equalsIgnoreCase(u.getScheme())||u.getHost()==null||u.getRawUserInfo()!=null||u.getRawFragment()!=null||(u.getPort()!=-1&&u.getPort()!=443)||u.getRawPath()==null||u.getRawPath().isEmpty()||"/".equals(u.getRawPath()))throw new IllegalArgumentException();
            return u.toASCIIString();
        }catch(Exception e){throw new IllegalArgumentException("آدرس مستقیم HTTPS معتبر لازم است.");}
    }
    private void clearVerified(){prefs().edit().remove("sha").remove("size").remove("mtime").apply();}
    private void verifyAsync(File f){if(!verifying.compareAndSet(false,true))return;worker.execute(()->{try{
        long size=f.length(),modified=f.lastModified();MessageDigest d=MessageDigest.getInstance("SHA-256");
        try(FileInputStream in=new FileInputStream(f)){byte[] b=new byte[1024*1024];int n;while((n=in.read(b))!=-1)d.update(b,0,n);}
        StringBuilder hex=new StringBuilder();for(byte x:d.digest())hex.append(String.format(Locale.ROOT,"%02x",x&255));
        if(!SHA.equals(hex.toString())||size!=f.length()||modified!=f.lastModified())throw new IllegalStateException("SHA-256 mismatch: remove the file and retry");
        prefs().edit().putString("sha",SHA).putLong("size",size).putLong("mtime",modified).apply();error="";
    }catch(Exception e){clearVerified();error="فایل دانلودشده معتبر نیست یا بررسی آن ناموفق بود؛ افزونه را حذف و دوباره دانلود کنید.";}finally{verifying.set(false);}});}
    private synchronized JSObject state(){File f=model();ActivityManager.MemoryInfo m=mem();JSObject out=new JSObject();long free=new StatFs(f.getParent()).getAvailableBytes();out.put("runtime",runtime);out.put("compatible",runtime&&arm64()&&m.totalMem>=MIN_RAM);out.put("ram",m.totalMem);out.put("availableRam",m.availMem);out.put("minAvailableRam",AiMemoryPolicy.requiredAvailable(m.threshold));out.put("memoryReady",AiMemoryPolicy.canGenerate(m.totalMem,m.availMem,m.threshold,m.lowMemory));out.put("lowMemory",m.lowMemory);out.put("contextLimit",AiMemoryPolicy.contextLimit(m.availMem,m.threshold));out.put("free",free);out.put("required",ESTIMATE+RESERVE);out.put("bytes",0);out.put("total",ESTIMATE);out.put("speech",Build.VERSION.SDK_INT>=31&&SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()));out.put("busy",busy.get());addProgress(out);
        String status="notInstalled";long id=prefs().getLong("download",-1);
        if(verified(f)){status="ready";out.put("bytes",f.length());out.put("total",f.length());}
        else if(id>=0){try(Cursor c=dm().query(new DownloadManager.Query().setFilterById(id))){if(c!=null&&c.moveToFirst()){
            int code=c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));long count=c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)),total=c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));out.put("bytes",Math.max(0,count));if(total>0)out.put("total",total);
            if(code==DownloadManager.STATUS_SUCCESSFUL){if(error.isEmpty()){verifyAsync(f);status="verifying";}else status="failed";}
            else if(code==DownloadManager.STATUS_FAILED){status="failed";error="دانلود ناموفق بود (کد "+c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))+").";}
            else if(code==DownloadManager.STATUS_PAUSED)status="paused";else status="downloading";
        }else{status="failed";error="دانلود در سیستم یافت نشد؛ دوباره تلاش کنید.";}}}
        if(verifying.get())status="verifying";out.put("status",status);out.put("error",error);return out;
    }
    @PluginMethod public void status(PluginCall c){try{c.resolve(state());}catch(Exception e){c.reject(e.getMessage());}}
    @PluginMethod public synchronized void download(PluginCall c){try{
        JSObject st=state();String s=st.getString("status");if("ready".equals(s)||"downloading".equals(s)||"paused".equals(s)||"verifying".equals(s)){c.resolve(st);return;}
        if(!st.optBoolean("compatible",false)||busy.get())throw new IllegalStateException("گوشی یا موتور اجرای مدل سازگار نیست.");
        String source=sourceUrl(c.getString("url"));
        if(runtime)nativeReleaseModel();
        File f=model();long previous=prefs().getLong("download",-1);if(previous>=0)dm().remove(previous);if(f.exists()&&!f.delete())throw new IllegalStateException("فایل قبلی حذف نشد.");clearVerified();prefs().edit().remove("download").apply();
        if(new StatFs(f.getParent()).getAvailableBytes()<ESTIMATE+RESERVE)throw new IllegalStateException("حداقل ۳٫۵ گیگابایت فضای آزاد برای دانلود و ذخیره امن لازم است.");
        DownloadManager.Request req=new DownloadManager.Request(Uri.parse(source));req.setTitle("Fix Quick AI — Qwen3 4B");req.setDescription("دانلود مدل آفلاین ۲٫۵ گیگابایت");req.setDestinationInExternalFilesDir(getContext(),null,DIR+"/"+FILE);req.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);req.setAllowedOverRoaming(false);req.setAllowedOverMetered(!Boolean.TRUE.equals(c.getBoolean("wifiOnly",true)));
        error="";long id=dm().enqueue(req);prefs().edit().putLong("download",id).apply();c.resolve(state());
    }catch(Exception e){c.reject(e.getMessage());}}
    @PluginMethod public synchronized void removeModel(PluginCall c){try{if(busy.get()||verifying.get())throw new IllegalStateException("ابتدا تحلیل یا بررسی فایل را تمام کنید.");if(runtime)nativeReleaseModel();long id=prefs().getLong("download",-1);if(id>=0)dm().remove(id);File f=model();if(f.exists()&&!f.delete())throw new IllegalStateException("فایل حذف نشد.");prefs().edit().clear().apply();error="";c.resolve(state());}catch(Exception e){c.reject(e.getMessage());}}
    @PluginMethod public synchronized void generate(PluginCall c){try{
        File f=model();String prompt=c.getString("prompt","");if(!runtime||!arm64()||!verified(f))throw new IllegalStateException("مدل معتبر آماده نیست.");if(prompt.isEmpty()||prompt.length()>10000)throw new IllegalStateException("متن سؤال یا مکالمه بیش از حد طولانی است.");
        ActivityManager.MemoryInfo m=mem();long minimum=AiMemoryPolicy.requiredAvailable(m.threshold);
        if(!AiMemoryPolicy.canGenerate(m.totalMem,m.availMem,m.threshold,m.lowMemory))throw new IllegalStateException(String.format(Locale.US,"حافظه برای تحلیل کافی نیست (رم قابل استفاده %.2f از حداقل %.2f گیگابایت%s). فایل مدل سالم است و نیازی به دانلود مجدد نیست.",m.availMem/1e9,minimum/1e9,m.lowMemory?"؛ هشدار کمبود حافظه اندروید":""));
        final int contextLimit=AiMemoryPolicy.contextLimit(m.availMem,m.threshold);
        if(destroyed||!busy.compareAndSet(false,true))throw new IllegalStateException("یک تحلیل در حال اجراست.");main.removeCallbacks(idleRelease);nativeResetCancel();int max=Math.max(16,Math.min(768,c.getInt("maxTokens",512)));final int timeout=Boolean.TRUE.equals(c.getBoolean("diagnostic",false))?180000:360000;worker.execute(()->{try{
            byte[] response=nativeGenerate(f.getAbsolutePath().getBytes(StandardCharsets.UTF_8),prompt.getBytes(StandardCharsets.UTF_8),max,Math.min(4,Runtime.getRuntime().availableProcessors()),timeout,contextLimit);
            JSObject out=new JSObject();out.put("text",new String(response,StandardCharsets.UTF_8));addProgress(out);busy.set(false);scheduleRelease();c.resolve(out);
        }catch(OutOfMemoryError e){nativeReleaseModel();busy.set(false);c.reject("حافظه هنگام تحلیل کافی نبود؛ مدل نصب‌شده حفظ شده است.");}catch(Exception e){String where=lastStage();nativeReleaseModel();busy.set(false);c.reject("تحلیل محلی کامل نشد: "+e.getMessage()+where);}});
    }catch(Exception e){c.reject(e.getMessage());}}
    @PluginMethod public synchronized void cancel(PluginCall c){if(runtime){if(busy.get())nativeCancel();else nativeReleaseModel();}c.resolve();}
    @PluginMethod public void listen(PluginCall c){if(getPermissionState("mic")!=PermissionState.GRANTED){requestPermissionForAlias("mic",c,"micResult");return;}startVoice(c);}
    @PermissionCallback private void micResult(PluginCall c){if(getPermissionState("mic")==PermissionState.GRANTED)startVoice(c);else c.reject("مجوز میکروفون داده نشد.");}
    private void finishVoice(String text,String err){PluginCall c=voiceCall;voiceCall=null;if(speech!=null){speech.destroy();speech=null;}if(c==null)return;if(err!=null)c.reject(err);else{JSObject r=new JSObject();r.put("text",text);c.resolve(r);}}
    private void startVoice(PluginCall c){main.post(()->{try{
        if(Build.VERSION.SDK_INT<31||!SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext()))throw new IllegalStateException("تشخیص گفتار آفلاین روی این گوشی در دسترس نیست. از تایپ استفاده کنید.");
        if(voiceCall!=null)throw new IllegalStateException("میکروفون در حال استفاده است.");voiceCall=c;speech=SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
        speech.setRecognitionListener(new RecognitionListener(){public void onReadyForSpeech(Bundle b){}public void onBeginningOfSpeech(){}public void onRmsChanged(float f){}public void onBufferReceived(byte[] b){}public void onEndOfSpeech(){}public void onPartialResults(Bundle b){}public void onEvent(int t,Bundle b){}
            public void onError(int e){finishVoice(null,"تشخیص گفتار فارسی آفلاین ناموفق بود ("+e+"). ممکن است بسته فارسی دستگاه نصب نباشد.");}
            public void onResults(Bundle b){ArrayList<String> r=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);if(r==null||r.isEmpty())finishVoice(null,"گفتار تشخیص داده نشد.");else finishVoice(r.get(0),null);}});
        Intent i=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);i.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"fa-IR");i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);speech.startListening(i);main.postDelayed(()->{if(voiceCall==c)finishVoice(null,"زمان تشخیص گفتار تمام شد.");},45000);
    }catch(Exception e){if(voiceCall==c)finishVoice(null,e.getMessage());else c.reject(e.getMessage());}});}
    @PluginMethod public void stopListening(PluginCall c){main.post(()->{if(voiceCall!=null)finishVoice(null,"ضبط لغو شد.");c.resolve();});}
    private int speechEpoch=0;
    private void closeTts(){speechEpoch++;if(tts!=null){tts.stop();tts.shutdown();tts=null;}}
    @PluginMethod public void stopSpeaking(PluginCall c){main.post(()->{closeTts();c.resolve();});}
    @PluginMethod public void speak(PluginCall c){main.post(()->{
        String text=c.getString("text","");if(text.isEmpty()){c.reject("متنی برای خواندن نیست.");return;}
        closeTts();final int epoch=speechEpoch;
        tts=new TextToSpeech(getContext(),status->main.post(()->{try{
            if(epoch!=speechEpoch||tts==null)throw new IllegalStateException("پخش لغو شد.");
            if(status!=TextToSpeech.SUCCESS||tts.getVoices()==null)throw new IllegalStateException("سرویس صوتی در دسترس نیست.");
            Voice v=tts.getVoices().stream().filter(x->"fa".equals(x.getLocale().getLanguage())&&!x.isNetworkConnectionRequired()).findFirst().orElse(null);
            if(v==null)throw new IllegalStateException("صدای فارسی آفلاین روی دستگاه موجود نیست.");
            if(tts.setVoice(v)==TextToSpeech.ERROR)throw new IllegalStateException("صدای آفلاین فعال نشد.");
            int result=tts.speak(text.substring(0,Math.min(text.length(),TextToSpeech.getMaxSpeechInputLength())),TextToSpeech.QUEUE_FLUSH,null,"fq-ai");
            if(result==TextToSpeech.ERROR)throw new IllegalStateException("پخش صدا ناموفق بود.");c.resolve();
        }catch(Exception e){c.reject(e.getMessage());}}));
    });}
    @Override protected synchronized void handleOnDestroy(){destroyed=true;main.removeCallbacks(idleRelease);if(runtime){if(busy.get())nativeCancel();worker.execute(()->nativeReleaseModel());}main.post(()->{if(voiceCall!=null)finishVoice(null,"صفحه بسته شد.");closeTts();});worker.shutdown();super.handleOnDestroy();}
}
