# Fix Quick 020 / 1.51 — local review
Base commit: 8de4c99d0952d237a53432ac397a7eb96b6c62f3
Patch only: apply the listed changed files over this exact commit. No GitHub write.

- Home-only assistant entry. If verified model unavailable, show install dialog on Home, not chat. Direct chat route guarded. Fresh readiness checks before entry and query/voice, user ownership guard and timeout. Model removal locks chat.
- Model URL, fixed SHA, native engine, financial calculations and storage paths unchanged.
- Install sheet shows download size, free space, download estimate, explicit confirmation, source details; verified file required for entry.
- Chat grid: independent content scroll and separate composer row; example questions collapsed by default.
- 15 Node suites passed. UI020 smoke passed using simulated native bridge with absent runtime, space gate, download/progress/verification, activation/reopen/removal and voice/financial query, five viewport sizes with 130% font. Previous UI016, UI018, UI019 smoke tests passed on gate/layout revision; UI020 rerun after final hardening.
- No actual Android APK built, actual GGUF download or native inference tested. No claim of device-level validation. APK should first be built in isolated validation branch and tested on a non-production device/database.
