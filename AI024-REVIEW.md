# Fix Quick v024 / 1.55 — native inference performance and diagnostics

- ARM64 llama CPU compilation explicitly optimized while preserving APK build/signature. CI checks effective optimization flags.
- Retain verified model weights briefly across calls (15-second idle release); no persistent prompt or context. Release on cancel/delete/destroy; separate per-call context.
- Native progress atomics expose model-load %, prompt tokens, generated tokens, elapsed time; no account data in telemetry. Cooperative timeout (180s diagnostic, 360s per normal inference); a stuck native operation may take longer to release.
- Diagnostic prompt shortened; stops at complete JSON; cancels explicitly. Prevent new questions while native worker busy.
- Existing model path, SHA, accounting algorithms, package and signing unchanged.
- 19 Node test suites, 8 Java memory policy checks, Chromium v023 integration (mock native), compiled C++ JSON completion helper passed locally. Actual Android build, model execution and performance not verified locally.
