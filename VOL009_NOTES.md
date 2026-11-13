# Fix Quick Vol 009 — Bank receipt and SMS support

- Deterministic on-device text parser now recognizes Persian and Arabic digits, date phrases (e.g. ۲۱ آبان ۱۴۰۵), transfer type, bank labels, tracking codes, and reports ambiguous values for human review.
- Paste bank SMS into receipt form; clipboard button has manual-paste fallback if Android WebView denies clipboard permission.
- Editable amount/date/tracking/time and bank fields. Pending or unknown receipt status requires independent confirmation of settlement before registering.
- Existing camera/gallery and native Latin ML Kit OCR retained. **Persian image OCR is NOT upgraded in this release**; optional slower Tesseract remains. No sub-two-second accuracy guarantee for images.
- Check account in banking app before approval; SMS screenshots and bank receipts are not proof of settlement.
- No migration or automatic accounting writes. All local persisted data stays untouched.
- Automated tests: `node tests/vol009.test.js` and all existing suites.
