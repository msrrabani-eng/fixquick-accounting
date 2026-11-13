#!/usr/bin/env bash
# Run after npm ci, before `npx cap sync android`. Download only at BUILD TIME.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p www/ocr/core www/ocr/lang
# Pin the OCR engine; never pull a CDN at app runtime.
npm install --no-save --package-lock=false --no-audit --no-fund tesseract.js@5.1.1
cp node_modules/tesseract.js/dist/tesseract.min.js www/ocr/tesseract.min.js
cp node_modules/tesseract.js/dist/worker.min.js www/ocr/worker.min.js
cp node_modules/tesseract.js-core/tesseract-core*.wasm* www/ocr/core/
for lang in fas eng; do
  curl --fail --location --retry 3 --silent --show-error \
    "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/main/${lang}.traineddata" \
    -o "www/ocr/lang/${lang}.traineddata"
  test -s "www/ocr/lang/${lang}.traineddata"
  gzip -n -f "www/ocr/lang/${lang}.traineddata"
done
# Fail the build rather than publishing an APK with a nonfunctional OCR button.
test -s www/ocr/tesseract.min.js
test -s www/ocr/worker.min.js
test -s www/ocr/core/tesseract-core.wasm.js
test -s www/ocr/lang/fas.traineddata.gz
test -s www/ocr/lang/eng.traineddata.gz
echo 'Local Persian+English OCR assets prepared.'
