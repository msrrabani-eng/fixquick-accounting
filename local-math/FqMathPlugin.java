package ir.fixquick.accounting;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.DownloadManager;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.*;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import java.io.*;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** The optional model is not bundled. Only the exact official GGUF is accepted. */
@CapacitorPlugin(name="FqLocalMath")
public final class FqMathPlugin extends Plugin {
    private static final String NAME="Qwen3-4B-Q4_K_M.gguf", DIR="local-math-v035";
    private static final String URL="https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf";
    private static final String SHA="7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5";
    private static final long MIN=2400000000L,MAX=2600000000L;
    private static final ExecutorService io=Executors.newSingleThreadExecutor();
    private static volatile boolean checking=false;
    private static volatile String failure="";
    private final Handler main=new Handler(Looper.getMainLooper());
    private volatile PluginCall active;
    private volatile long started=0;
    private volatile String executionStage="idle", lastRunError="";
    private volatile int loadPercent=0, generated=0;
    private boolean stopping=false;
    private volatile boolean recheckFailed=false;
    private ServiceConnection conn;
    private Messenger remote;
    private Runnable alarm;
    private boolean bound=false,probe=false;
    private SharedPreferences prefs(){return getContext().getSharedPreferences("fq_local_math_v035",Context.MODE_PRIVATE);}
    private File dir(){File d=getContext().getExternalFilesDir(DIR);if(d==null)throw new IllegalStateException("Storage unavailable");if(!d.isDirectory()&&!d.mkdirs())throw new IllegalStateException("Cannot create model folder");return d;}
    private File model(){return new File(dir(),NAME);}
    private File partial(){return new File(dir(),"download.gguf.part");}
    private DownloadManager dm(){return (DownloadManager)getContext().getSystemService(Context.DOWNLOAD_SERVICE);}
    private boolean supported(){for(String abi:Build.SUPPORTED_ABIS)if(abi.equals("arm64-v8a"))return true;return false;}
    private boolean verified(){File f=model();return f.isFile()&&f.length()>=MIN&&f.length()<=MAX&&prefs().getLong("length",-1)==f.length()&&prefs().getLong("modified",-1)==f.lastModified()&&SHA.equals(prefs().getString("sha",""));}
    private void checkSpace() throws IOException {if(dir().getUsableSpace()<MAX+100000000L)throw new IOException("At least 2.7 GB free storage required");}
    private void hash(File f) throws Exception {
        if(f.length()<MIN||f.length()>MAX)throw new IOException("Model file size incorrect");
        MessageDigest md=MessageDigest.getInstance("SHA-256");byte[] buf=new byte[1024*1024];
        try(InputStream in=new BufferedInputStream(new FileInputStream(f))){int k;while((k=in.read(buf))!=-1)md.update(buf,0,k);}
        StringBuilder hex=new StringBuilder();for(byte b:md.digest())hex.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
        if(!SHA.equals(hex.toString()))throw new IOException("Model SHA-256 mismatch; choose official Q4_K_M file");
    }
    private void install(File file) throws Exception {
        hash(file);File target=model();
        if(!file.equals(target)){if(target.exists())throw new IOException("Existing model preserved; replacement requires manual review");if(!file.renameTo(target))throw new IOException("Model move failed");}
        if(!prefs().edit().putString("sha",SHA).putLong("length",target.length()).putLong("modified",target.lastModified()).putBoolean("tested",false).commit())throw new IOException("Could not record verification");
    }
    private synchronized void scheduleVerify(File input,long id){
        if(checking)return;checking=true;failure="";
        io.execute(()->{try{install(input);recheckFailed=false;}catch(Exception e){failure=String.valueOf(e.getMessage());if(input.equals(model()))recheckFailed=true;else input.delete();}finally{
            if(id>=0){try{dm().remove(id);}catch(Exception ignored){}prefs().edit().remove("download").commit();}
            checking=false;
        }});
    }
    private JSObject state(){
        JSObject j=new JSObject();j.put("supported",supported());j.put("ready",false);j.put("tested",false);j.put("bytes",0L);j.put("total",2500000000L);j.put("running",active!=null);j.put("stage",executionStage);j.put("elapsed",active==null?0:Math.max(0,SystemClock.elapsedRealtime()-started));j.put("loadPercent",loadPercent);j.put("generated",generated);j.put("runError",lastRunError);
        if(!supported()){j.put("phase","unsupported");return j;}
        if(checking){j.put("phase","checking");return j;}
        if(verified()){j.put("phase","ready");j.put("ready",true);j.put("tested",prefs().getBoolean("tested",false));j.put("bytes",model().length());j.put("total",model().length());return j;}
        if(model().exists()){if(recheckFailed){j.put("phase","preserved");j.put("error",failure);return j;}scheduleVerify(model(),-1);j.put("phase","checking");return j;}
        long id=prefs().getLong("download",-1);
        if(id>=0){
            try(Cursor c=dm().query(new DownloadManager.Query().setFilterById(id))){
                if(c!=null&&c.moveToFirst()){
                    int s=c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    j.put("bytes",c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)));
                    long total=c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));if(total>0)j.put("total",total);
                    if(s==DownloadManager.STATUS_SUCCESSFUL){scheduleVerify(partial(),id);j.put("phase","checking");return j;}
                    if(s!=DownloadManager.STATUS_FAILED){j.put("phase",s==DownloadManager.STATUS_PAUSED?"paused":"downloading");return j;}
                    failure="Download failed: "+c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON));
                }else{failure="Download record unavailable";}
            }
            dm().remove(id);prefs().edit().remove("download").commit();partial().delete();
        }
        j.put("phase",failure.isEmpty()?"missing":"error");j.put("error",failure);return j;
    }
    @PluginMethod public synchronized void status(PluginCall call){try{call.resolve(state());}catch(Exception e){call.reject(String.valueOf(e.getMessage()));}}
    @PluginMethod public synchronized void download(PluginCall call){
        try{JSObject s=state();String phase=s.getString("phase");if(!supported())throw new IOException("64-bit ARM device required");if("ready".equals(phase)||"preserved".equals(phase)||"checking".equals(phase)||"downloading".equals(phase)||"paused".equals(phase)){call.resolve(s);return;}
            checkSpace();if(partial().exists()&&!partial().delete())throw new IOException("Previous partial file cannot be removed");
            DownloadManager.Request r=new DownloadManager.Request(Uri.parse(URL));r.setTitle("Fix Quick — Qwen3 4B");r.setDescription("Optional offline math model");r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE);r.setAllowedOverRoaming(false);r.setDestinationInExternalFilesDir(getContext(),DIR,"download.gguf.part");
            long id=dm().enqueue(r);if(!prefs().edit().putLong("download",id).commit()){dm().remove(id);throw new IOException("Could not persist download");}
            failure="";call.resolve(state());
        }catch(Exception e){call.reject(String.valueOf(e.getMessage()));}
    }
    @PluginMethod public synchronized void cancelDownload(PluginCall call){
        try{if(checking||model().exists()){call.resolve(state());return;}long id=prefs().getLong("download",-1);if(id>=0)dm().remove(id);prefs().edit().remove("download").commit();partial().delete();failure="";call.resolve(state());}catch(Exception e){call.reject(String.valueOf(e.getMessage()));}
    }
    @PluginMethod public synchronized void importModel(PluginCall call){
        try{String p=state().getString("phase");if(!supported())throw new IOException("64-bit ARM device required");if(!"missing".equals(p)&&!"error".equals(p)){call.resolve(state());return;}
            checkSpace();Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT);i.addCategory(Intent.CATEGORY_OPENABLE);i.setType("*/*");startActivityForResult(call,i,"importResult");
        }catch(Exception e){call.reject(String.valueOf(e.getMessage()));}
    }
    @ActivityCallback private synchronized void importResult(PluginCall call,ActivityResult result){
        if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null||result.getData().getData()==null){call.resolve(state());return;}
        try{String phase=state().getString("phase");if(!"missing".equals(phase)&&!"error".equals(phase)){call.resolve(state());return;}checkSpace();}catch(Exception e){call.reject(String.valueOf(e.getMessage()));return;}
        Uri uri=result.getData().getData();checking=true;failure="";
        io.execute(()->{File tmp=null;try{
            tmp=new File(dir(),"import.gguf.part");long count=0;
            try(InputStream in=getContext().getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(tmp)){
                if(in==null)throw new IOException("File not readable");byte[] buf=new byte[1024*1024];int n;while((n=in.read(buf))!=-1){count+=n;if(count>MAX)throw new IOException("File too large");out.write(buf,0,n);}
            }install(tmp);
        }catch(Exception e){failure=String.valueOf(e.getMessage());if(tmp!=null)tmp.delete();}finally{checking=false;}});call.resolve(state());
    }
    @PluginMethod public void solve(PluginCall call){main.post(()->begin(call,false));}
    @PluginMethod public void test(PluginCall call){main.post(()->begin(call,true));}
    @PluginMethod public void stop(PluginCall call){main.post(()->{if(active!=null)requestStop("Cancelled");call.resolve(state());});}
    private void requestStop(String reason){
        if(active==null||stopping)return;stopping=true;executionStage="stopping";lastRunError=reason;
        PluginCall current=active;cancelWork();
        if(alarm!=null)main.removeCallbacks(alarm);
        alarm=()->{if(active==current)finish(null,reason,0);};main.postDelayed(alarm,5000);
    }
    private void begin(PluginCall call,boolean test){
        if(active!=null){call.reject("A model request is already running; use stop to reset it.");return;}
        try{
            if(!supported()||!verified())throw new IOException("Download and verify model first");
            ActivityManager.MemoryInfo m=new ActivityManager.MemoryInfo();((ActivityManager)getContext().getSystemService(Context.ACTIVITY_SERVICE)).getMemoryInfo(m);
            if(m.lowMemory||m.totalMem<5000000000L||m.availMem<1300000000L)throw new IOException("Insufficient available RAM; close other apps");
            String prompt=test?"<|im_start|>system\nAnswer with only the requested number.<|im_end|>\n<|im_start|>user\n17 + 25 = ? /no_think<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n":call.getString("prompt","");
            if(prompt.isEmpty()||prompt.length()>12000)throw new IOException("Invalid prompt length");
            active=call;probe=test;started=SystemClock.elapsedRealtime();executionStage="connecting";lastRunError="";loadPercent=0;generated=0;stopping=false;
            alarm=()->{if(active==call)requestStop("Inference timeout (180 s)");};main.postDelayed(alarm,180000);
            Messenger reply=new Messenger(new Handler(Looper.getMainLooper(),msg->{
                if(active!=call)return true;Bundle b=msg.getData();
                if(msg.what==4){if(!stopping){executionStage=b.getString("stage","loading");loadPercent=b.getInt("percent",0);generated=b.getInt("tokens",0);}return true;}
                if(msg.what==3)finish(stopping?null:b.getString("text"),stopping?lastRunError:b.getString("error"),b.getLong("ms"));return true;
            }));
            conn=new ServiceConnection(){
                @Override public void onServiceConnected(ComponentName name,IBinder binder){
                    if(active!=call)return;remote=new Messenger(binder);if(stopping){cancelWork();return;}executionStage="loading";try{Message msg=Message.obtain(null,1);Bundle b=new Bundle();b.putString("prompt",prompt);b.putInt("max",test?24:640);msg.setData(b);msg.replyTo=reply;remote.send(msg);}catch(Exception e){finish(null,"Engine connection failed",0);}
                }
                @Override public void onServiceDisconnected(ComponentName name){if(active==call)finish(null,"Engine process stopped; possible memory pressure",0);}
                @Override public void onBindingDied(ComponentName name){if(active==call)finish(null,"Engine process stopped",0);}
                @Override public void onNullBinding(ComponentName name){if(active==call)finish(null,"Engine unavailable",0);}
            };
            bound=getContext().bindService(new Intent(getContext(),FqMathService.class),conn,Context.BIND_AUTO_CREATE);
            if(!bound){finish(null,"Could not start local engine",0);return;}

        }catch(Exception e){if(active==call)finish(null,String.valueOf(e.getMessage()),0);else call.reject(String.valueOf(e.getMessage()));}
    }
    private void cancelWork(){try{if(remote!=null)remote.send(Message.obtain(null,2));}catch(Exception ignored){}}
    private void finish(String answer,String err,long ms){
        PluginCall call=active;boolean t=probe;active=null;probe=false;stopping=false;executionStage="idle";started=0;lastRunError=err==null?"":err;
        if(alarm!=null)main.removeCallbacks(alarm);alarm=null;
        if(bound&&conn!=null)try{getContext().unbindService(conn);}catch(Exception ignored){}bound=false;conn=null;remote=null;
        if(call==null)return;
        if(err!=null||answer==null||answer.trim().isEmpty()){call.reject(err==null?"No model answer":err);return;}
        JSObject j=new JSObject();j.put("text",answer);j.put("ms",ms);
        if(t){boolean ok=answer.trim().matches("42[.]?|۴۲[.]?");prefs().edit().putBoolean("tested",ok).commit();j.put("passed",ok);}
        call.resolve(j);
    }
}
