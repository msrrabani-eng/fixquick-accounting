# Fix Quick v008 OCR

Fast Android on-device OCR uses Google ML Kit Latin script bundled AAR 16.0.1. This is not Persian OCR. It can extract amounts/tracking numbers and Latin account details from receipts rapidly without uploading images. Actual timing varies by device; app gives a 4.5 second clear failure instead of indefinite spinner. Optional Persian Tesseract remains manual (slow) and its assets bundled at build time.

Future full Persian modern model candidate: PaddleOCR PP-OCRv5 Arabic/Persian mobile recognizer, requiring ONNX/Paddle Lite native inference and model bundling. Do not claim this is integrated yet.

The extracted receipt is ALWAYS a draft requiring human review; no automatic posting to ledger. Verify `ir.fixquick.accounting` package, fixed key and versionCode before release. Test actual APK on Android, Persian receipt with clear/blurred image, repeated number, disconnected phone, camera + gallery, and verify no data loss on upgrade.
