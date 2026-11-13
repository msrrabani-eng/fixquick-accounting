/* Fix Quick v006 — local-only OCR of camera/gallery receipt images.
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
      const maxDimension = 2400;
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
  async function recognize(file, onProgress) {
    validateFile(file);
    if (!root.Tesseract || typeof root.Tesseract.createWorker !== 'function') {
      throw Error('موتور خواندن عکس در این نسخه APK موجود نیست؛ می‌توانید متن فیش را دستی وارد کنید.');
    }
    const blob = await resize(file);
    const imgUrl = URL.createObjectURL(blob);
    let worker;
    try {
      worker = await root.Tesseract.createWorker(['fas', 'eng'], 1, {
        workerPath: new URL('ocr/worker.min.js', location.href).href,
        corePath: new URL('ocr/core', location.href).href,
        langPath: new URL('ocr/lang', location.href).href,
        logger: m => { if (onProgress && m && m.status) onProgress(m.status, m.progress || 0); }
      });
      const data = await worker.recognize(imgUrl);
      const text = String(data && data.data && data.data.text || '').trim();
      if (!text) throw Error('متنی در تصویر تشخیص داده نشد؛ عکس واضح‌تری بگیرید یا متن فیش را دستی وارد کنید.');
      return { text, confidence: Number(data.data.confidence) || 0 };
    } finally {
      URL.revokeObjectURL(imgUrl);
      if (worker) await worker.terminate();
    }
  }
  root.ReceiptOCR = { recognize, validateFile, MAX_IMAGE_BYTES };
  if (typeof module !== 'undefined' && module.exports) module.exports = { validateFile, MAX_IMAGE_BYTES };
})(typeof window !== 'undefined' ? window : globalThis);
