# Fix Quick VOL 022 (1.53) — local review only
Base: v021 / 1.52. Not uploaded to GitHub. No APK build or real Qwen inference was performed.
- Separate read-only cheque reports from hypothetical weighted maturity calculations. Distinguish cashbox receivables, bank collection and outgoing cheques; exact day vs cumulative period; separate installments and exclude settled/spent cheques.
- Weighted maturity uses integer Rial inputs and exact integer weighted sum, nearest-day rounding, confirmation of a user-entered list, and no posting.
- Answer provenance displayed. A model-suggested ledger query requires confirmation before lookup; ambiguous cheque questions cannot be silently converted into a different ledger report by Qwen.
- All 17 Node regression suites passed (including 1000 existing colloquial queries and 178 new assertions). Chromium UI smoke: both screenshot questions reproduced, multi-turn maturity and model query confirmation tested with a simulated native bridge; ledger JSON unchanged.
- Older static assertions updated only for cache/version and renamed context variable. Native memory policy, pinned model and storage path, accounting core, signing and database untouched.
- Real ledger values and local Qwen quality on the user's phone cannot be checked here. No guarantee of universal natural-language understanding. Archive contains changed files only; apply to matching base, not as a whole-repository replacement.
