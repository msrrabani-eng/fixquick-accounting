package ir.fixquick.accounting;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

/** Offline, on-device fast pass for numbers and Latin text in bank receipts.
 *  The supported recognizer is Latin script; it does not claim to read Persian.
 *  Data is never transmitted by this plugin and is never saved here.
 */
@CapacitorPlugin(name = "FastReceiptOCR")
public class FastReceiptOCR extends Plugin {
    @PluginMethod
    public void recognize(PluginCall call) {
        final String encoded = call.getString("base64");
        if (encoded == null || encoded.isEmpty() || encoded.length() > 20_000_000) {
            call.reject("تصویر نامعتبر یا بیش از حد بزرگ است.");
            return;
        }
        try {
            // Data URLs supported, but callers normally send bare base64.
            final String raw = encoded.contains(",") ? encoded.substring(encoded.indexOf(',') + 1) : encoded;
            final byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
            if (bytes.length > 12 * 1024 * 1024) { call.reject("حجم تصویر بیش از حد مجاز است."); return; }
            final BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
            int max = Math.max(bounds.outWidth, bounds.outHeight);
            if (max <= 0) { call.reject("عکس قابل خواندن نیست."); return; }
            final BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = 1;
            while (max / opts.inSampleSize > 1800) opts.inSampleSize *= 2;
            final Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
            if (bitmap == null) { call.reject("عکس قابل خواندن نیست."); return; }
            final long started = android.os.SystemClock.elapsedRealtime();
            final com.google.mlkit.vision.text.TextRecognizer client = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            client.process(InputImage.fromBitmap(bitmap, 0))
                .addOnSuccessListener(result -> {
                    JSObject out = new JSObject();
                    out.put("text", result.getText());
                    out.put("durationMs", android.os.SystemClock.elapsedRealtime() - started);
                    out.put("engine", "MLKit-Latin-OnDevice");
                    call.resolve(out);
                })
                .addOnFailureListener(e -> call.reject("تشخیص سریع ناموفق بود: " + e.getMessage()))
                .addOnCompleteListener(task -> { bitmap.recycle(); client.close(); });
        } catch (Exception e) { call.reject("خواندن تصویر ناموفق بود: " + e.getMessage()); }
    }
}
