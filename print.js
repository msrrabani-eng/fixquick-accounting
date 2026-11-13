/* A5 invoice → PDF (drawn straight on canvas, no libraries; works offline in the Android WebView) */
const PRINT = { W: 1240, H: 1748, M: 80, FONT: 'Vazirmatn, Tahoma, "Noto Sans Arabic", "Noto Naskh Arabic", Arial, sans-serif' };

function loadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }

function wrapText(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur); return lines.length ? lines : [''];
}

// inv: Core invoice; returns array of canvases (A5 pages)
async function drawInvoicePages(inv) {
  const info = Core.invoiceInfo(S, inv), logo = await loadImg('logo.png');
  const { W, H, M, FONT } = PRINT, R = W - M, L = M, ink = '#111827', mut = '#64748b', line = '#cbd5e1', brand = '#1d4ed8';
  const isSaleSide = inv.type === 'sale' || inv.type === 'purchase_return';
  const person = Core.byId(S.people, inv.personId) || { name: '—' };
  const pages = []; let cv, ctx, y;
  const font = (px, w) => ctx.font = (w || 400) + ' ' + px + 'px ' + FONT;
  const txt = (s, x, yy, align, color) => { ctx.textAlign = align || 'right'; ctx.fillStyle = color || ink; ctx.fillText(String(s), x, yy); };
  // columns (right → left): ردیف | شرح | تعداد | قیمت | جمع
  const colR = [R, R - 70, R - 70 - 430, R - 70 - 430 - 150, R - 70 - 430 - 150 - 190, L];
  const colHdr = ['ردیف', 'شرح کالا', 'تعداد', 'قیمت واحد (ریال)', 'جمع (ریال)'];
  const newPage = first => {
    cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d'); ctx.direction = 'rtl';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); pages.push(cv); y = M;
    // header
    if (logo) { const lh = 92, lw = lh * logo.width / logo.height; ctx.drawImage(logo, L, y, lw, lh); }
    font(46, 800); txt('فاکتور ' + Core.TYPE_FA[inv.type], R, y + 44, 'right', brand);
    font(26, 400); txt((S.settings.business || 'فیکس کوییک'), R, y + 86, 'right', mut);
    y += 112; ctx.strokeStyle = brand; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke(); y += 28;
    if (first) {
      font(28, 700); txt((isSaleSide ? 'مشتری: ' : 'تأمین‌کننده: ') + person.name + (person.phone ? '   ' + Core.toFa(person.phone) : ''), R, y + 28);
      font(26, 400); txt('شماره: ' + Core.toFa(inv.no), L + 380, y + 28, 'right', ink); txt('تاریخ: ' + Core.fmtDate(inv.date), L, y + 28, 'left', ink);
      ctx.textAlign = 'right'; y += 56;
      if (inv.note) { font(24, 400); const nl = wrapText(ctx, 'توضیحات: ' + inv.note, R - L); nl.forEach(t => { txt(t, R, y + 24, 'right', mut); y += 34; }); }
      y += 10;
    }
    // table header
    ctx.fillStyle = '#eff6ff'; ctx.fillRect(L, y, R - L, 52); ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.strokeRect(L, y, R - L, 52);
    font(24, 700); for (let c = 0; c < 5; c++) { const cx = c === 1 ? colR[c] - 12 : (colR[c] + colR[c + 1]) / 2; txt(colHdr[c], cx, y + 35, c === 1 ? 'right' : 'center'); }
    y += 52;
  };
  const footer = n => {
    const c = pages[n]; const x = c.getContext('2d'); x.direction = 'rtl'; x.strokeStyle = line; x.lineWidth = 2; x.beginPath(); x.moveTo(L, H - 96); x.lineTo(R, H - 96); x.stroke();
    x.font = '400 22px ' + FONT; x.fillStyle = mut; x.textAlign = 'center'; x.fillText('Fix Quick  ·  fixq.ir  ·  ' + Core.toFa('09999917199') + (pages.length > 1 ? '  ·  صفحه ' + Core.toFa(n + 1) + ' از ' + Core.toFa(pages.length) : ''), W / 2, H - 56);
  };
  newPage(true);
  const limit = () => H - 96 - 20; // content bottom
  info.lines.forEach((l, idx) => {
    ctx.save(); font(25, 600); const nameLines = wrapText(ctx, prodName(l.productId), colR[1] - colR[2] - 24);
    font(21, 400); const noteLines = l.note ? wrapText(ctx, '🔖 ' + l.note, colR[1] - colR[2] - 24) : []; ctx.restore();
    const h = Math.max(56, 14 + nameLines.length * 34 + noteLines.length * 28);
    if (y + h > limit() - 40) { newPage(false); }
    ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.strokeRect(L, y, R - L, h);
    for (let c = 1; c < 5; c++) { ctx.beginPath(); ctx.moveTo(colR[c], y); ctx.lineTo(colR[c], y + h); ctx.stroke(); }
    font(24, 400); txt(Core.toFa(idx + 1), (colR[0] + colR[1]) / 2, y + h / 2 + 8, 'center');
    let ty = y + 36; font(25, 600); nameLines.forEach(t => { txt(t, colR[1] - 12, ty); ty += 34; });
    font(21, 400); noteLines.forEach(t => { txt(t, colR[1] - 12, ty - 6, 'right', mut); ty += 28; });
    font(24, 400); txt(Core.fmtQty(l.qty) + ' ' + unitOf(l.productId), (colR[2] + colR[3]) / 2, y + h / 2 + 8, 'center');
    txt(fmt(l.price), (colR[3] + colR[4]) / 2, y + h / 2 + 8, 'center'); font(24, 700); txt(fmt(l.gross), (colR[4] + colR[5]) / 2, y + h / 2 + 8, 'center');
    y += h;
  });
  // totals
  const rows = [['جمع اقلام', fmt(info.sub) + ' ریال']]; if (info.discount) rows.push(['تخفیف', fmt(info.discount) + ' ریال']);
  rows.push(['مبلغ نهایی', fmt(info.total) + ' ریال', true]); rows.push([isSaleSide ? 'دریافت‌شده' : 'پرداخت‌شده', fmt(info.paid) + ' ریال']); rows.push(['مانده', fmt(info.remaining) + ' ریال', true]);
  const need = rows.length * 48 + 40 + 150; if (y + need > limit()) newPage(false);
  y += 24; const bx = L, bw = 520;
  rows.forEach(r => { if (r[2]) { ctx.fillStyle = '#eff6ff'; ctx.fillRect(bx, y, bw, 46); } font(r[2] ? 28 : 25, r[2] ? 800 : 400); txt(r[0], bx + bw - 14, y + 33, 'right'); txt(r[1], bx + 14, y + 33, 'left', r[2] ? brand : ink); ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.strokeRect(bx, y, bw, 46); y += 46; });
  // signatures
  const sy = Math.min(limit() - 110, Math.max(y + 40, H - 96 - 170)); font(23, 400);
  [['امضای فروشنده', R - 250], ['امضای خریدار', R - 250 - 330]].forEach(s => { txt(s[0], s[1] + 125, sy + 24, 'center', mut); ctx.strokeStyle = line; ctx.strokeRect(s[1], sy + 36, 250, 70); });
  pages.forEach((_, n) => footer(n));
  return pages;
}

function canvasesToPdf(pages) {
  const enc = s => new TextEncoder().encode(s), parts = [], offs = []; let len = 0;
  const push = b => { parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(enc(n + ' 0 obj\n')); push(body); push(enc('\nendobj\n')); };
  push(enc('%PDF-1.4\n')); const N = pages.length, PW = 419.53, PH = 595.28;
  obj(1, enc('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, enc('<< /Type /Pages /Count ' + N + ' /Kids [' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>'));
  pages.forEach((cv, i) => {
    const b = 3 + i * 3, jpg = atob(cv.toDataURL('image/jpeg', 0.9).split(',')[1]), bytes = new Uint8Array(jpg.length); for (let k = 0; k < jpg.length; k++) bytes[k] = jpg.charCodeAt(k);
    obj(b, enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 ' + (b + 1) + ' 0 R >> >> /Contents ' + (b + 2) + ' 0 R >>'));
    offs[b + 1] = len; push(enc((b + 1) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bytes.length + ' >>\nstream\n')); push(bytes); push(enc('\nendstream\nendobj\n'));
    const c = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q'; obj(b + 2, enc('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'));
  });
  const total = 3 + N * 3, xr = len; let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n'; for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  push(enc(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF'));
  const out = new Uint8Array(len); let p = 0; parts.forEach(b => { out.set(b, p); p += b.length; }); return out;
}

async function printInvoice(id) {
  const inv = Core.byId(S.invoices, id); if (!inv) return;
  try {
    toast('در حال ساخت فایل چاپ…'); const pdf = canvasesToPdf(await drawInvoicePages(inv));
    await exportBinary('invoice-' + Core.toEn(String(inv.no)) + '.pdf', pdf, 'application/pdf');
  } catch (e) { toast('ساخت فایل چاپ ناموفق بود: ' + (e.message || e), true); }
}
