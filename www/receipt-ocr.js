/* Fix Quick v008 — native fast OCR plus optional Persian OCR of camera/gallery receipt images.
 * No uploads, no storage and no automatic accounting writes.
 * The OCR runtime and Persian+English language data are bundled in the APK.
 */
(function(root) {
  'use strict';
  const MAX_IMAGE_BYTES = 24 * 1024 * 1024;
  function validateFile(file) {
    if (!file || !/^image\//i.test(file.type || '')) throw Error('فقط عکس فیش بانکی (JPG، PNG و مانند آن) قابل انتخاب است.');
    if (file.size > MAX_IMAGE_BYTES) throw Error('حجم تصویر بیشتر از ۲۴ مگابایت است؛ عکس کوچک‌تری انتخاب کنید.');
  }
  async function resize(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const picture = new Image();
        picture.onload = () => resolve(picture);
        picture.onerror = () => reject(Error('تصویر خوانده نشد.'));
        picture.src = url;
      });
      if (!img.naturalWidth || !img.naturalHeight) throw Error('ابعاد تصویر نامعتبر است.');
      const maxDimension = 1400; // lower pixel count reduces offline recognition latency
      const scale = Math.min(1, maxDimension / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('امکان پردازش این عکس وجود ندارد.');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(Error('آماده‌سازی عکس ناموفق بود.')), 'image/jpeg', 0.92));
    } finally { URL.revokeObjectURL(url); }
  }
  // Keep the expensive offline language initialization cached for the session.
  // A cold start can take longer than two seconds on real devices.
  function nativePlugin() {
    return root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform() &&
      root.Capacitor.Plugins && root.Capacitor.Plugins.FastReceiptOCR;
  }
  function readBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(Error('عکس قابل خواندن نیست.'));
      reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
      reader.readAsDataURL(blob);
    });
  }
  // Fast native pass: no WebAssembly worker, no language download, no backend.
  async function fastRecognize(file, onProgress) {
    validateFile(file);
    const plugin = nativePlugin();
    if (!plugin || typeof plugin.recognize !== 'function') throw Error('موتور سریع در این نسخه APK نصب نشده است.');
    if (onProgress) onProgress('خواندن سریع اطلاعات عددی', 0);
    const blob = await resize(file);
    const base64 = await readBase64(blob);
    let timeoutId;
    const result = await Promise.race([
      plugin.recognize({base64}),
      new Promise((_, reject) => { timeoutId = setTimeout(() => reject(Error('تشخیص سریع زمان زیادی گرفت؛ متن فیش را دستی بررسی کنید.')), 4500); })
    ]).finally(() => clearTimeout(timeoutId));
    const found = String(result && result.text || '').trim();
    if (!found) throw Error('در مرحله سریع، عدد یا متن لاتین قابل تشخیص نبود. برای متن فارسی از گزینه تکمیلی استفاده کنید.');
    return {text:found, confidence:0, engine:'MLKit-Latin-OnDevice', durationMs:result.durationMs};
  }
  let workerPromise = null;
  let queue = Promise.resolve();
  let prepared = false;
  const CONFIG = () => ({
    workerPath: new URL('ocr/worker.min.js', location.href).href,
    corePath: new URL('ocr/core', location.href).href,
    langPath: new URL('ocr/lang', location.href).href
  });
  function warmup() {
    if (!root.Tesseract || typeof root.Tesseract.createWorker !== 'function') {
      return Promise.reject(Error('موتور OCR در این نسخه نصب نشده است.'));
    }
    if (!workerPromise) {
      workerPromise = root.Tesseract.createWorker(['fas', 'eng'], 1, CONFIG())
        .then(worker => { prepared = true; return worker; })
        .catch(err => { workerPromise = null; prepared = false; throw err; });
    }
    return workerPromise;
  }
  function isReady() { return prepared; }
  async function recognize(file, onProgress) {
    validateFile(file);
    // OCR work is serialized to avoid races on the shared worker.
    const action = async () => {
      if (onProgress) onProgress('آماده‌سازی تصویر', 0);
      const blob = await resize(file);
      const imgUrl = URL.createObjectURL(blob);
      try {
        if (onProgress) onProgress('بارگذاری موتور آفلاین فارسی و انگلیسی', 0);
        const worker = await warmup();
        if (onProgress) onProgress('خواندن متن عکس', 0);
        const result = await worker.recognize(imgUrl);
        const text = String(result && result.data && result.data.text || '').trim();
        if (!text) throw Error('متنی شناسایی نشد؛ تصویر روشن‌تر یا متن دستی را امتحان کنید.');
        return { text, confidence: Number(result.data.confidence) || 0 };
      } finally { URL.revokeObjectURL(imgUrl); }
    };
    const task = queue.then(action, action);
    queue = task.catch(() => {});
    return task;
  }
  // Start background preparation without blocking navigation or forms.
  function prewarm() {
    return warmup().catch(() => null);
  }
  // Some Android WebViews do not free worker memory unless explicitly asked.
  async function dispose() {
    if (!workerPromise) return;
    const p = workerPromise;
    workerPromise = null;
    prepared = false;
    try { const w = await p; await w.terminate(); } catch (_) {}
  }
  root.ReceiptOCR = { recognize, fastRecognize, nativePlugin, prewarm, warmup, isReady, dispose, validateFile, MAX_IMAGE_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = { validateFile, MAX_IMAGE_BYTES };
})(typeof window !== 'undefined' ? window : globalThis);
