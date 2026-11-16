package ir.fixquick.accounting;

import android.app.Service;
import android.content.Intent;
import android.os.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.atomic.AtomicBoolean;

/** Separate worker process. No accounting bridge, database, or networking code. */
public final class FqMathService extends Service {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private final AtomicBoolean running=new AtomicBoolean(false);
    private static final boolean loaded;
    static { boolean ok;try{System.loadLibrary("fqmath");ok=true;}catch(Throwable e){ok=false;}loaded=ok; }
    static native byte[] nativeRun(byte[] path,byte[] prompt,int max);
    static native void nativeStop();
    static native void nativeReset();
    private final Messenger inbound=new Messenger(new Handler(Looper.getMainLooper(),msg->{
        if(msg.what==2){if(loaded)nativeStop();return true;}
        if(msg.what!=1||msg.replyTo==null)return true;
        final Messenger reply=msg.replyTo;
        if(!loaded||!running.compareAndSet(false,true)){send(reply,null,"Native engine unavailable or busy",0);return true;}
        final Bundle args=msg.getData();final String prompt=args.getString("prompt","");final int limit=args.getInt("max",640);
        nativeReset();
        worker.execute(()->{
            long start=SystemClock.elapsedRealtime();String answer=null,error=null;
            try{
                java.io.File dir=getExternalFilesDir("local-math-v035");
                java.io.File model=new java.io.File(dir,"Qwen3-4B-Q4_K_M.gguf");
                if(dir==null||!model.isFile())throw new IllegalStateException("Verified model file missing");
                byte[] data=nativeRun(model.getAbsolutePath().getBytes(StandardCharsets.UTF_8),prompt.getBytes(StandardCharsets.UTF_8),limit);
                answer=new String(data,StandardCharsets.UTF_8);
            }catch(Throwable e){error=e.getMessage()==null?e.getClass().getSimpleName():e.getMessage();}
            finally{running.set(false);}
            send(reply,answer,error,SystemClock.elapsedRealtime()-start);
        });
        return true;
    }));
    private static void send(Messenger reply,String answer,String error,long ms){
        try{Message m=Message.obtain(null,3);Bundle b=new Bundle();b.putString("text",answer);b.putString("error",error);b.putLong("ms",ms);m.setData(b);reply.send(m);}catch(RemoteException ignored){}
    }
    @Override public IBinder onBind(Intent i){return inbound.getBinder();}
    @Override public void onDestroy(){if(loaded)nativeStop();worker.shutdown();super.onDestroy();}
}
