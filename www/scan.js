/* Camera scanner: QR (always, via jsQR) and product barcodes (where the phone supports BarcodeDetector).
 * Back camera, continuous autofocus, tap-to-focus, flash (torch) and zoom when the camera offers them. */
const Scan = { stream: null, track: null, timer: null, det: null, last: '', lastAt: 0 };

async function scanDetector() {
  if (Scan.det !== null) return Scan.det;
  Scan.det = false;
  try { if ('BarcodeDetector' in window) { const f = await BarcodeDetector.getSupportedFormats(); if (f && f.length) Scan.det = new BarcodeDetector({ formats: f }); } } catch (e) { Scan.det = false; }
  return Scan.det;
}
function scanBeep() {
  try { if (navigator.vibrate) navigator.vibrate(60); } catch (e) { /* ignore */ }
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const a = Scan.ac || (Scan.ac = new C()), o = a.createOscillator(), g = a.createGain(); o.frequency.value = 1500; g.gain.value = 0.08; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.09); } catch (e) { /* ignore */ }
}
function scanStop() {
  clearTimeout(Scan.timer); Scan.timer = null;
  if (Scan.stream) Scan.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { /* ignore */ } });
  Scan.stream = null; Scan.track = null;
  const o = document.getElementById('scan'); if (o) o.remove();
  document.body.classList.remove('noscroll');
}
async function scanApply(c) { if (!Scan.track) return false; try { await Scan.track.applyConstraints({ advanced: [c] }); return true; } catch (e) { return false; } }

// o: { title, hint, continuous, onCode(text) → true to keep scanning in continuous mode }
async function openScanner(o) {
  scanStop(); o = o || {}; Scan.last = ''; Scan.lastAt = 0;
  const el = document.createElement('div'); el.id = 'scan';
  el.innerHTML = '<video playsinline muted autoplay></video><div class="sc-frame"><i></i></div><div class="sc-ring" hidden></div>' +
    '<div class="sc-top"><button type="button" class="sc-x" aria-label="بستن">✕</button><b>' + esc(o.title || 'اسکن کد') + '</b><span></span></div>' +
    '<div class="sc-msg">' + esc(o.hint || 'کد را داخل کادر بگیرید. برای فوکوس، روی تصویر بزنید.') + '</div>' +
    '<div class="sc-bar"><button type="button" class="sc-b" data-sc="torch" hidden>🔦<small>فلش</small></button><label class="sc-zoom" hidden><span>زوم</span><input type="range" min="1" max="1" step="0.1" value="1"></label><button type="button" class="sc-b" data-sc="flip" hidden>🔄<small>دوربین</small></button><button type="button" class="sc-b" data-sc="type">⌨️<small>دستی</small></button></div>';
  document.body.appendChild(el); document.body.classList.add('noscroll');
  const v = el.querySelector('video'), msg = el.querySelector('.sc-msg'), ring = el.querySelector('.sc-ring');
  el.querySelector('.sc-x').onclick = scanStop;
  el.querySelector('[data-sc=type]').onclick = () => { let m = el.querySelector('.sc-man'); if (m) { m.remove(); return; } m = document.createElement('form'); m.className = 'sc-man'; m.innerHTML = '<input name="c" autocomplete="off" placeholder="کد یا بارکد"><button type="submit">تأیید</button>'; el.appendChild(m); m.c.focus(); m.onsubmit = e => { e.preventDefault(); const t = m.c.value.trim(); m.remove(); if (t) hit(t); }; };
  let facing = 'environment', torchOn = false;
  try { torchOn = localStorage.getItem('fq_torch') === '1'; } catch (e) { /* ignore */ }

  const hit = async text => {
    const now = Date.now(), still = text === Scan.last && now - Scan.lastAt < 1200; Scan.last = text; Scan.lastAt = now; if (still) return; // same code still in view: count it once
    scanBeep(); el.classList.add('sc-ok'); setTimeout(() => el.classList.remove('sc-ok'), 350);
    let keep = false; try { keep = await o.onCode(text); } catch (e) { diagLog('scan', e.message, e.stack); }
    if (!(o.continuous && keep)) scanStop();
  };

  async function start() {
    if (Scan.stream) Scan.stream.getTracks().forEach(t => t.stop());
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg.textContent = 'این گوشی اجازه استفاده از دوربین را به برنامه نمی‌دهد. کد را دستی وارد کنید.'; return; }
    try {
      Scan.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } } });
    } catch (e) {
      msg.innerHTML = (e && e.name === 'NotAllowedError') ? 'اجازه دوربین داده نشده است. در تنظیمات گوشی ← برنامه‌ها ← فیکس کوییک ← مجوزها، «دوربین» را روشن کنید.' : 'دوربین باز نشد (' + esc(e && e.name || e) + '). کد را دستی وارد کنید.'; return;
    }
    v.srcObject = Scan.stream; try { await v.play(); } catch (e) { /* ignore */ }
    Scan.track = Scan.stream.getVideoTracks()[0];
    const caps = (Scan.track.getCapabilities && Scan.track.getCapabilities()) || {};
    if (caps.focusMode && caps.focusMode.includes('continuous')) await scanApply({ focusMode: 'continuous' });
    const tb = el.querySelector('[data-sc=torch]');
    if (caps.torch) { tb.hidden = false; tb.classList.toggle('on', torchOn); if (torchOn) await scanApply({ torch: true }); tb.onclick = async () => { torchOn = !torchOn; if (await scanApply({ torch: torchOn })) { tb.classList.toggle('on', torchOn); try { localStorage.setItem('fq_torch', torchOn ? '1' : '0'); } catch (e) { /* ignore */ } } }; } else tb.hidden = true;
    const zl = el.querySelector('.sc-zoom'), zi = zl.querySelector('input');
    if (caps.zoom && caps.zoom.max > caps.zoom.min) { zl.hidden = false; zi.min = caps.zoom.min; zi.max = Math.min(caps.zoom.max, caps.zoom.min * 8); zi.step = caps.zoom.step || 0.1; zi.value = caps.zoom.min; zi.oninput = () => scanApply({ zoom: +zi.value }); } else zl.hidden = true;
    try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); el.querySelector('[data-sc=flip]').hidden = cams.length < 2; } catch (e) { /* ignore */ }
    loop();
  }
  el.querySelector('[data-sc=flip]').onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; start(); };
  // tap to focus at that point (when the camera supports it), else re-trigger autofocus
  v.addEventListener('click', async ev => {
    const r = v.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
    ring.hidden = false; ring.style.left = (ev.clientX - 30) + 'px'; ring.style.top = (ev.clientY - 30) + 'px'; ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go');
    const caps = (Scan.track && Scan.track.getCapabilities && Scan.track.getCapabilities()) || {};
    if (!(await scanApply({ pointsOfInterest: [{ x, y }], focusMode: 'single-shot' }))) { if (caps.focusMode && caps.focusMode.includes('single-shot')) await scanApply({ focusMode: 'single-shot' }); }
    setTimeout(() => { if (caps.focusMode && caps.focusMode.includes('continuous')) scanApply({ focusMode: 'continuous' }); }, 1500);
  });

  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  const det = await scanDetector();
  async function loop() {
    if (!Scan.stream || !document.getElementById('scan')) return;
    if (v.readyState >= 2 && v.videoWidth) {
      let text = null;
      try {
        if (det) { const r = await det.detect(v); if (r && r.length) text = r[0].rawValue; }
        if (!text && window.jsQR) {
          // center crop (the frame area), downscaled for speed
          const vw = v.videoWidth, vh = v.videoHeight, s = Math.min(vw, vh) * 0.8, sx = (vw - s) / 2, sy = (vh - s) / 2, n = Math.min(480, Math.round(s));
          cv.width = n; cv.height = n; cx.drawImage(v, sx, sy, s, s, 0, 0, n, n);
          const img = cx.getImageData(0, 0, n, n), q = jsQR(img.data, n, n, { inversionAttempts: 'attemptBoth' });
          if (q && q.data) text = q.data;
        }
      } catch (e) { /* keep scanning */ }
      if (text) await hit(text);
    }
    if (Scan.stream) Scan.timer = setTimeout(loop, 120);
  }
  start();
}

/* ── product codes ── */
// what a product's QR holds: stable id-based token (labels stay valid if the name or code changes)
const prodQrText = p => 'FQP-' + p.id;
function findProductByCode(text) {
  const t = String(text || '').trim(); if (!t) return null;
  const m = t.match(/^FQP-(\d+)$/i); if (m) { const p = Core.byId(S.products, +m[1]); if (p) return p; }
  const n = normQ(t);
  return S.products.find(p => p.barcode && normQ(p.barcode) === n) || S.products.find(p => p.sku && normQ(p.sku) === n) || null;
}
function qrCanvas(text, px) {
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), quiet = 4, cell = Math.max(1, Math.floor(px / (n + quiet * 2))), size = cell * (n + quiet * 2);
  const c = document.createElement('canvas'); c.width = size; c.height = size; const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, size, size); x.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (q.isDark(r, k)) x.fillRect((k + quiet) * cell, (r + quiet) * cell, cell, cell);
  return c;
}
