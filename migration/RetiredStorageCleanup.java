package ir.fixquick.accounting;
import android.app.DownloadManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.File;

/** Removes only the retired optional download and its own preferences. Safe to retry. */
final class RetiredStorageCleanup {
    private RetiredStorageCleanup() {}
    static void run(Context context) {
        try {
            SharedPreferences p = context.getSharedPreferences("fq_ai_model_v1", Context.MODE_PRIVATE);
            long id = p.getLong("download", -1L);
            if (id >= 0) {
                DownloadManager dm = (DownloadManager)context.getSystemService(Context.DOWNLOAD_SERVICE);
                if (dm == null) return;
                dm.remove(id);
            }
            File root = context.getExternalFilesDir(null);
            if (root == null) return;
            File dir = new File(root, "ai");
            File retired = new File(dir, "Qwen3-4B-Q4_K_M.gguf");
            if (!retired.getCanonicalFile().equals(new File(root.getCanonicalFile(), "ai/Qwen3-4B-Q4_K_M.gguf"))) return;
            if (retired.exists() && !retired.delete()) return;
            if (dir.isDirectory()) dir.delete(); // only removes an empty directory
            p.edit().clear().commit();
        } catch (Exception e) {
            Log.w("FixQuickStorage", "Retired download cleanup will retry on next launch", e);
        }
    }
}
