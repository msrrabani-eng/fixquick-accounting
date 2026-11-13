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
  const weSell = inv.type === 'sale' || inv.type === 'sale_return', me = sellerName();
  const person = Core.byId(S.people, inv.personId) || { name: '—' };
  const pages = []; let cv, ctx, y;
  const font = (px, w) => ctx.font = (w || 400) + ' ' + px + 'px ' + FONT;
  const txt = (s, x, yy, align, color) => { ctx.textAlign = align || 'right'; ctx.fillStyle = color || ink; ctx.fillText(String(s), x, yy); };
  // columns (right → left): ردیف | شرح | تعداد | قیمت | جمع
  const colR = [R, R - 70, R - 70 - 430, R - 70 - 430 - 150, R - 70 - 430 - 150 - 190, L];
  const colHdr = ['ردیف', 'شرح کالا', 'تعداد', 'قیمت واحد (' + UNIT() + ')', 'جمع (' + UNIT() + ')'];
  const newPage = first => {
    cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d'); ctx.direction = 'rtl';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); pages.push(cv); y = M;
    // header
    if (logo) { const lh = 92, lw = lh * logo.width / logo.height; ctx.drawImage(logo, L, y, lw, lh); }
    font(46, 800); txt('فاکتور ' + Core.TYPE_FA[inv.type], R, y + 62, 'right', brand);
    y += 112; ctx.strokeStyle = brand; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke(); y += 28;
    if (first) {
      // parties: who sold, who bought (a return keeps the roles of the original deal)
      const ph = person.phone ? '   ' + Core.toFa(person.phone) : '';
      font(27, 400); txt('فروشنده: ', R, y + 28, 'right', mut); txt('خریدار: ', R, y + 72, 'right', mut);
      const lw = Math.max(ctx.measureText('فروشنده: ').width, ctx.measureText('خریدار: ').width) + 6;
      font(28, 700); const room = R - lw - (L + 330); // keep clear of number/date on the left
      const fit = (t, extra) => { t = String(t || '—'); const w = room - (extra ? ctx.measureText(extra).width : 0); if (ctx.measureText(t).width <= w) return t + (extra || ''); while (t.length > 1 && ctx.measureText(t + '…').width > w) t = t.slice(0, -1); return t.trim() + '…' + (extra || ''); };
      const them = fit(person.name, ph), mine = fit(me);
      txt(weSell ? mine : them, R - lw, y + 28); txt(weSell ? them : mine, R - lw, y + 72);
      font(26, 400); txt('شماره: ' + Core.toFa(inv.no), L, y + 28, 'left', ink); txt('تاریخ: ' + Core.fmtDate(inv.date), L, y + 72, 'left', ink);
      ctx.textAlign = 'right'; y += 100;
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
    x.font = '400 22px ' + FONT; x.fillStyle = mut; x.textAlign = 'center'; x.fillText('حسابداری فیکس کوییک' + (licOk ? '' : '  ·  ' + Core.toFa('09999917199') + '  ·  fixq.ir') + (pages.length > 1 ? '  ·  صفحه ' + Core.toFa(n + 1) + ' از ' + Core.toFa(pages.length) : ''), W / 2, H - 56);
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
  const rows = [['جمع اقلام', fmt(info.sub) + ' ' + UNIT()]]; if (info.discount) rows.push(['تخفیف', fmt(info.discount) + ' ' + UNIT()]); if (info.vat) rows.push(['ارزش افزوده ' + Core.toFa(info.vatRate) + '٪', fmt(info.vat) + ' ' + UNIT()]);
  rows.push(['مبلغ نهایی', fmt(info.total) + ' ' + UNIT(), true]); rows.push([isSaleSide ? 'دریافت‌شده' : 'پرداخت‌شده', fmt(info.paid) + ' ' + UNIT()]); rows.push(['مانده', fmt(info.remaining) + ' ' + UNIT(), true]);
  const need = rows.length * 48 + 40 + 150 + 70; if (y + need > limit()) newPage(false);
  y += 24; const bx = L, bw = 520;
  rows.forEach(r => { if (r[2]) { ctx.fillStyle = '#eff6ff'; ctx.fillRect(bx, y, bw, 46); } font(r[2] ? 28 : 25, r[2] ? 800 : 400); txt(r[0], bx + bw - 14, y + 33, 'right'); txt(r[1], bx + 14, y + 33, 'left', r[2] ? brand : ink); ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.strokeRect(bx, y, bw, 46); y += 46; });
  if (info.total) { font(22, 400); const ww = wrapText(ctx, 'مبلغ نهایی به حروف: ' + Core.moneyWords(info.total), R - L); ww.forEach(t => { txt(t, R, y + 30, 'right', mut); y += 32; }); y += 4; }
  // signatures
  const sy = Math.min(limit() - 110, Math.max(y + 40, H - 96 - 170)); font(23, 400);
  [['امضای فروشنده', R - 250], ['امضای خریدار', R - 250 - 330]].forEach(s => { txt(s[0], s[1] + 125, sy + 24, 'center', mut); ctx.strokeStyle = line; ctx.strokeRect(s[1], sy + 36, 250, 70); });
  pages.forEach((_, n) => footer(n));
  return pages;
}

function jpegBytes(cv) { const s = atob(cv.toDataURL('image/jpeg', 0.9).split(',')[1]), b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k); return b; }
// imgs: [{ jpg: Uint8Array (JPEG bytes), w, h }] → one PDF, one image per page
function imagesToPdf(imgs, pw, ph) {
  const enc = s => new TextEncoder().encode(s), parts = [], offs = []; let len = 0;
  const push = b => { parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; push(enc(n + ' 0 obj\n')); push(body); push(enc('\nendobj\n')); };
  push(enc('%PDF-1.4\n')); const N = imgs.length, PW = pw || 419.53, PH = ph || 595.28;
  obj(1, enc('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, enc('<< /Type /Pages /Count ' + N + ' /Kids [' + imgs.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + '] >>'));
  imgs.forEach((im, i) => {
    const b = 3 + i * 3, bytes = im.jpg;
    obj(b, enc('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im0 ' + (b + 1) + ' 0 R >> >> /Contents ' + (b + 2) + ' 0 R >>'));
    offs[b + 1] = len; push(enc((b + 1) + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + im.w + ' /Height ' + im.h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bytes.length + ' >>\nstream\n')); push(bytes); push(enc('\nendstream\nendobj\n'));
    const c = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im0 Do Q'; obj(b + 2, enc('<< /Length ' + c.length + ' >>\nstream\n' + c + '\nendstream'));
  });
  const total = 3 + N * 3, xr = len; let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n'; for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  push(enc(x + 'trailer\n<< /Size ' + total + ' /Root 1 0 R >>\nstartxref\n' + xr + '\n%%EOF'));
  const out = new Uint8Array(len); let p = 0; parts.forEach(b => { out.set(b, p); p += b.length; }); return out;
}
function canvasesToPdf(pages, pw, ph) { return imagesToPdf(pages.map(cv => ({ jpg: jpegBytes(cv), w: cv.width, h: cv.height })), pw, ph); }

async function printInvoice(id) {
  const inv = Core.byId(S.invoices, id); if (!inv) return;
  try {
    toast('در حال ساخت فایل چاپ…'); const pdf = canvasesToPdf(await drawInvoicePages(inv));
    await exportBinary('invoice-' + Core.toEn(String(inv.no)) + '.pdf', pdf, 'application/pdf');
  } catch (e) { toast('ساخت فایل چاپ ناموفق بود: ' + (e.message || e), true); }
}

/* person statement (صورت‌حساب) → PDF, A4. Pages are encoded to JPEG as soon as they are full, so a long history never keeps many big canvases in memory. */
async function drawStatementPages(p, from, to) {
  const L0 = Core.ledger(S, p.id, from, to), logo = await loadImg('logo.png');
  const { W, H, M, FONT } = PRINT, R = W - M, L = M, ink = '#111827', mut = '#64748b', line = '#cbd5e1', brand = '#1d4ed8';
  const cols = [170, 0, 200, 200, 220]; // date | description (rest of the width) | debit | credit | balance, right to left
  const DESC = (R - L) - cols[0] - cols[2] - cols[3] - cols[4];
  const edge = [R]; edge.push(edge[0] - cols[0]); edge.push(edge[1] - DESC); edge.push(edge[2] - cols[2]); edge.push(edge[3] - cols[3]); edge.push(L);
  const hdr = ['تاریخ', 'شرح', 'بدهکار', 'بستانکار', 'مانده'];
  const tagOf = v => v > 0 ? 'بد' : v < 0 ? 'بس' : '';
  const me = sellerName() || 'فروشنده', them = p.name || 'شخص';
  const owes = v => v > 0 ? ' (بدهکار: ' + them + ')' : v < 0 ? ' (بدهکار: ' + me + ')' : ' (تسویه)'; // names, not «you», so it reads right for whoever holds the paper
  const out = []; let cv = null, ctx = null, y = 0;
  const font = (px, w) => ctx.font = (w || 400) + ' ' + px + 'px ' + FONT;
  const txt = (s, x, yy, align, color) => { ctx.textAlign = align || 'right'; ctx.fillStyle = color || ink; ctx.fillText(String(s), x, yy); };
  const flush = () => {
    if (!cv) return; ctx.textAlign = 'center'; ctx.fillStyle = mut; font(22, 400);
    ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L, H - 96); ctx.lineTo(R, H - 96); ctx.stroke();
    ctx.fillText('حسابداری فیکس کوییک' + (licOk ? '' : '  ·  ' + Core.toFa('09999917199') + '  ·  fixq.ir') + '  ·  صفحه ' + Core.toFa(out.length + 1), W / 2, H - 56);
    out.push({ jpg: jpegBytes(cv), w: cv.width, h: cv.height }); cv = null;
  };
  const tableHead = () => { ctx.fillStyle = '#eff6ff'; ctx.fillRect(L, y, R - L, 52); ctx.strokeStyle = line; ctx.lineWidth = 2; ctx.strokeRect(L, y, R - L, 52); font(24, 700); for (let c = 0; c < 5; c++) txt(hdr[c], (edge[c] + edge[c + 1]) / 2, y + 35, 'center'); y += 52; };
  const newPage = first => {
    flush(); cv = document.createElement('canvas'); cv.width = W; cv.height = H; ctx = cv.getContext('2d'); ctx.direction = 'rtl';
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); y = M;
    if (first) {
      if (logo) { const lh = 92, lw = lh * logo.width / logo.height; ctx.drawImage(logo, L, y, lw, lh); }
      font(46, 800); txt('صورت‌حساب', R, y + 62, 'right', brand); y += 112;
      ctx.strokeStyle = brand; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(R, y); ctx.stroke(); y += 28;
      font(27, 400); txt('شخص: ', R, y + 28, 'right', mut); txt('تلفن: ', R, y + 72, 'right', mut);
      const lw = Math.max(ctx.measureText('شخص: ').width, ctx.measureText('تلفن: ').width) + 6;
      font(28, 700); txt(p.name || '—', R - lw, y + 28); txt(p.phone ? Core.toFa(p.phone) : '—', R - lw, y + 72, 'right', ink);
      font(26, 400); txt('تاریخ صدور: ' + Core.fmtDate(Core.todayISO()), L, y + 28, 'left', ink);
      txt('بازه: ' + (from ? Core.fmtDate(from) : 'ابتدا') + ' تا ' + (to ? Core.fmtDate(to) : 'امروز'), L, y + 72, 'left', ink);
      y += 100;
      const sumDr = L0.rows.reduce((t, r) => t + r.debit, 0), sumCr = L0.rows.reduce((t, r) => t + r.credit, 0);
      const cards = [];
      if (from) cards.push(['مانده از قبل', fmt(Math.abs(L0.carry)) + ' ' + UNIT() + owes(L0.carry)]);
      cards.push(['جمع بدهکار این بازه', fmt(sumDr) + ' ' + UNIT()], ['جمع بستانکار این بازه', fmt(sumCr) + ' ' + UNIT()]);
      cards.push(['مانده نهایی', fmt(Math.abs(L0.closing)) + ' ' + UNIT() + owes(L0.closing), true]);
      cards.forEach(c => { if (c[2]) { ctx.fillStyle = '#eff6ff'; ctx.fillRect(L, y, R - L, 50); } font(25, c[2] ? 800 : 400); txt(c[0], R - 14, y + 34, 'right', c[2] ? brand : mut); txt(c[1], L + 14, y + 34, 'left', c[2] ? brand : ink); ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.strokeRect(L, y, R - L, 50); y += 50; });
      font(21, 400); txt('بدهکار: بدهی ' + them + ' زیاد شده (مثلاً خرید او).  بستانکار: کم شده (مثلاً پرداخت او).', R, y + 34, 'right', mut); txt('مانده «بد» یعنی ' + them + ' بدهکار است و «بس» یعنی ' + me + ' بدهکار است.', R, y + 66, 'right', mut); y += 96;
    }
    tableHead();
  };
  newPage(true);
  if (from && L0.carry) { const h = 48; ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.strokeRect(L, y, R - L, h); font(24, 400); txt('مانده از قبل', edge[2] - 14, y + 32, 'right'); txt(fmt(Math.abs(L0.carry)) + ' ' + tagOf(L0.carry), edge[4] - 14, y + 32, 'right'); y += h; }
  if (!L0.rows.length) { font(26, 400); txt('در این بازه تراکنشی ثبت نشده است.', W / 2, y + 60, 'center', mut); }
  for (const r of L0.rows) { // oldest first, so the opening balance and the running balance read top to bottom
    ctx.save(); font(24, 400); const dl = wrapText(ctx, r.tx.desc || Core.TYPE_FA[r.tx.type] || 'ثبت دستی', DESC - 24); ctx.restore();
    const h = Math.max(50, 16 + dl.length * 32);
    if (y + h > H - 96 - 30) newPage(false);
    ctx.strokeStyle = line; ctx.lineWidth = 1.5; ctx.strokeRect(L, y, R - L, h);
    for (let c = 1; c < 5; c++) { ctx.beginPath(); ctx.moveTo(edge[c], y); ctx.lineTo(edge[c], y + h); ctx.stroke(); }
    const mid = y + h / 2 + 8;
    font(23, 400); txt(Core.fmtDate(r.tx.date), (edge[0] + edge[1]) / 2, mid, 'center');
    let ty = y + 34; font(24, 400); dl.forEach(t => { txt(t, edge[1] - 12, ty); ty += 32; });
    font(24, 400); if (r.debit) txt(fmt(r.debit), (edge[2] + edge[3]) / 2, mid, 'center', '#c62828');
    if (r.credit) txt(fmt(r.credit), (edge[3] + edge[4]) / 2, mid, 'center', '#168447');
    txt(fmt(Math.abs(r.balance)) + (tagOf(r.balance) ? ' ' + tagOf(r.balance) : ''), (edge[4] + edge[5]) / 2, mid, 'center');
    y += h;
  }
  if (y + 140 > H - 96) newPage(false);
  flush();
  return out;
}
async function printStatement(p, from, to) {
  try { toast('در حال ساخت صورت‌حساب…'); const pdf = imagesToPdf(await drawStatementPages(p, from, to)); await exportBinary('statement-' + p.id + '-' + stamp() + '.pdf', pdf, 'application/pdf'); }
  catch (e) { toast('ساخت صورت‌حساب ناموفق بود: ' + (e.message || e), true); }
}

/* QR labels on A4: 3 × 8 grid (70 × 37 mm, standard 24-up label sheets) */
async function drawLabelPages(items, opt) {
  opt = opt || {}; const W = 1240, H = 1754, cols = 3, rows = 8, mmx = W / 210, lw = 70 * mmx, lh = 37 * mmx, top = (H - rows * lh) / 2;
  const { FONT } = PRINT, pages = []; let cv, x, i = 0;
  for (const it of items) {
    if (i % (cols * rows) === 0) { cv = document.createElement('canvas'); cv.width = W; cv.height = H; x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.direction = 'rtl'; pages.push(cv); }
    const k = i % (cols * rows), c = cols - 1 - (k % cols), r = Math.floor(k / cols), lx = c * lw, ly = top + r * lh, pad = 14;
    if (opt.guides) { x.strokeStyle = '#d0d5dd'; x.lineWidth = 1; x.strokeRect(lx + 0.5, ly + 0.5, lw - 1, lh - 1); }
    const qs = lh - pad * 2, q = qrCanvas(prodQrText(it.p), qs); x.imageSmoothingEnabled = false; x.drawImage(q, lx + pad, ly + pad, qs, qs);
    const tx = lx + lw - pad, tw = lw - qs - pad * 3; x.textAlign = 'right'; x.fillStyle = '#111827';
    x.font = '700 26px ' + FONT; const lines = wrapText(x, it.p.name, tw).slice(0, 3); let ty = ly + pad + 30; lines.forEach(t => { x.fillText(t, tx, ty); ty += 32; });
    x.font = '400 22px ' + FONT; x.fillStyle = '#4b5563';
    if (it.p.sku) { x.fillText(Core.toFa(it.p.sku), tx, ty + 4); ty += 30; }
    if (opt.price && it.p.salePrice) { x.font = '700 24px ' + FONT; x.fillStyle = '#111827'; x.fillText(fmt(it.p.salePrice) + ' ' + UNIT(), tx, ly + lh - pad - 6); }
    i++;
  }
  return pages;
}
async function printLabels(products, copies, opt) {
  const items = []; products.forEach(p => { for (let c = 0; c < copies; c++) items.push({ p }); });
  if (!items.length) return toast('کالایی برای چاپ نیست.', true);
  if (items.length > 960) return toast('حداکثر ۹۶۰ برچسب در هر بار چاپ (۴۰ برگه). فهرست را با جستجو کوتاه‌تر کنید.', true);
  try { toast('در حال ساخت برچسب‌ها…'); const pdf = canvasesToPdf(await drawLabelPages(items, opt), 595.28, 841.89); await exportBinary('labels-' + stamp() + '.pdf', pdf, 'application/pdf'); }
  catch (e) { toast('ساخت برچسب ناموفق بود: ' + (e.message || e), true); }
}
