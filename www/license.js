/* Free limit + device-bound activation for the unlimited version.
 * The activation code is an ECDSA P-256 signature (made only by the owner's private key)
 * over this phone's device code, so it cannot be forged, and on another phone it does not verify. */
(function (root) {
  'use strict';
  const L = {};
  L.FREE_LIMIT = 50;
  // owner settings shown on the payment screen — change here
  L.PRICE_TEXT = '۲٬۵۰۰٬۰۰۰ تومان (۲۵٬۰۰۰٬۰۰۰ ریال)';
  L.TERM_DAYS = 365; // a code made by the generator is valid this long
  L.TERM_TEXT = 'اعتبار یک‌ساله از روز فعال‌سازی. برای سال بعد، تمدید با قیمت روز و همراه آپدیت‌های جدید انجام می‌شود.';
  L.CARD_NO = '6219-8619-3578-1806';
  L.CARD_BANK = 'بلو بانک';
  L.CARD_OWNER = 'محمد صادق ربانی';
  L.SUPPORT_WA = '989999917199';
  // public key only; the private key stays with the owner (license generator file)
  const PUB = { kty: 'EC', crv: 'P-256', x: 'DuE8E0PsSyyZNsfmA-WQmkx58jYA1nPG5t1MuQ883qk', y: 'twt8PF4Lim1_b7fc7GnR9UnQUu3ln8saFOvGFfbnDaU' };
  const MSG = 'FQ-UNLIMITED-1|', MSG2 = 'FQ-UNLIMITED-2|';
  // dated codes (v2): 2 bytes = expiry as days since 2026-01-01, then the 64-byte signature over device + expiry
  const EPOCH = Date.UTC(2026, 0, 1);
  const dayOf = iso => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - EPOCH) / 864e5);
  const isoOf = d => new Date(EPOCH + d * 864e5).toISOString().slice(0, 10);
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I, O, 0, 1 (easy to read and type)

  const sub = () => (root.crypto && root.crypto.subtle) || (typeof require === 'function' ? require('crypto').webcrypto.subtle : null);
  function b32(bytes) { let bits = 0, v = 0, out = ''; for (const b of bytes) { v = (v << 8) | b; bits += 8; while (bits >= 5) { out += A[(v >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += A[(v << (5 - bits)) & 31]; return out; }
  function unb32(s) { const out = []; let bits = 0, v = 0; for (const ch of s) { const i = A.indexOf(ch); if (i < 0) return null; v = (v << 5) | i; bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return new Uint8Array(out); }
  L.normCode = s => String(s || '').replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).toUpperCase().replace(/[^A-Z0-9]/g, '');
  L.group = (s, n) => s.match(new RegExp('.{1,' + (n || 4) + '}', 'g')).join('-');

  // short, readable code derived from the phone's id
  L.deviceCodeFrom = async function (rawId) {
    const h = new Uint8Array(await sub().digest('SHA-256', new TextEncoder().encode('fq-device|' + rawId)));
    return L.group(b32(h).slice(0, 12));
  };
  // → { ok, exp }: ok = genuine code for this device; exp = last valid day (ISO) for dated codes, null for the old lifetime codes
  L.check = async function (code, deviceCode) {
    try {
      const raw = unb32(L.normCode(code)); if (!raw || raw.length < 64) return { ok: false, exp: null };
      const key = await sub().importKey('jwk', PUB, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']), dev = L.normCode(deviceCode);
      const ver = (sig, msg) => sub().verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, new TextEncoder().encode(msg));
      if (raw.length === 66) { const exp = isoOf((raw[0] << 8) | raw[1]); return { ok: await ver(raw.slice(2, 66), MSG2 + dev + '|' + exp), exp }; }
      return { ok: await ver(raw.slice(0, 64), MSG + dev), exp: null };
    } catch (e) { return { ok: false, exp: null }; }
  };
  L.verify = async (code, deviceCode) => (await L.check(code, deviceCode)).ok;
  L.expBytes = exp => { const d = dayOf(exp); return new Uint8Array([(d >> 8) & 255, d & 255]); };
  L.msg2 = (deviceCode, exp) => MSG2 + L.normCode(deviceCode) + '|' + exp;
  L.dated = (sig, exp) => { const b = new Uint8Array(66); b.set(L.expBytes(exp), 0); b.set(sig, 2); return L.group(b32(b), 5); };
  // used by the owner's generator (and tests) — needs the private key
  // exp (ISO date) → a dated code; without exp → an old-style lifetime code
  L.sign = async function (privJwk, deviceCode, exp) {
    const key = await sub().importKey('jwk', privJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    const sig = new Uint8Array(await sub().sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(exp ? L.msg2(deviceCode, exp) : MSG + L.normCode(deviceCode))));
    return exp ? L.dated(sig, exp) : L.group(b32(sig), 5);
  };

  // documents that count toward the free limit: invoices, separate receipts/payments/manual entries, transfers, expenses
  L.countDocs = function (st) {
    let n = st.invoices.length + st.expenses.length; const groups = new Set();
    for (const t of st.tx) {
      if (t.type === 'transfer') { groups.add(t.group); continue; }
      if (t.ref == null && (t.type === 'receipt' || t.type === 'payment' || t.type === 'manual')) n++;
    }
    n += (st.vouchers || []).filter(v => v.kind === 'manual').length + (st.whTx || []).length; // manual vouchers and warehouse transfers are documents too
    return n + groups.size;
  };

  L._b32 = b32; L.MSG = MSG;
  if (typeof module !== 'undefined' && module.exports) module.exports = L; else root.License = L;
})(typeof window !== 'undefined' ? window : globalThis);
