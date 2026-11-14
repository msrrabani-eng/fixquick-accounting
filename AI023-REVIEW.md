# Fix Quick 023 (1.54) — model-first integration, local review

Base: published v021 (1.52), plus the unpublished v022 fixes. This is an incremental source patch, not an APK or a full repository replacement.

## Changes
- Every new conversational question reaches the installed Qwen native generate bridge first. Explicit continuations/confirmations of a local calculator remain deterministic. No automatic word-keyword answer is substituted if Qwen fails.
- Typed allowlisted report requests (19 metrics), explicit scopes, relative periods and validated dates. Existing read-only core calculations supply verified values; the language model receives bounded report evidence and is called again to interpret it. No SQL, file access, writes or arbitrary execution are exposed. Permission checks occur before each read and after inference. Recent conversation from the same permission session provides follow-up context.
- Cheque cashbox/bank/issued filters and weighted maturity calculator kept from v022. Exact date versus cumulative date separated. Finance parsing fixes the overlapping remaining principal/original principal labels.
- An actual on-device model generation diagnostic is available in installed-addon management. It does not read ledger data and distinguishes installed file status from successful inference. The diagnostic here was tested with a mocked bridge only.
- Native context-size rounding is bounded by the selected cap. Model ID, file path, SHA-256, download source, Java installer/verification, accounting core, signing workflow and model storage unchanged (workflow adds regression tests).

## Verified locally
- 18 Node test suites (including 1,000 legacy deterministic-language cases, 178 v022 assertions, new typed-report nonzero independent oracles and mocked model orchestration).
- 8 Java memory-policy assertions using simulated Android memory values.
- 7 Chromium integration suites, including model-first UI round trip with mocked native outputs, invoice/draft/layout, inventory, installation lifecycle, permissions, backups UI and glossary. No real backup restore performed.
- JavaScript syntax checks and YAML parser passed. Core blob unchanged: 4b7ea9f24cac68d42060b5fe5e1ddfcadbbd177b.

## Not verified / release gate
- Real 2.5 GB Qwen model weights, actual ARM64 inference latency, language quality and memory consumption on the Nothing Phone 2a are not accessible in this environment. Mock outputs are NOT model accuracy tests. Android SDK/NDK full compilation and signed APK validation must run in the isolated GitHub validation branch before publication. On-device diagnostic and representative end-to-end questions with known ledger totals are required to establish actual model functionality. The diagnostic alone cannot validate financial interpretations.
- Report access is bounded to the implemented read-only tools, at most 2 reports per turn; the model can misinterpret questions or give imperfect general advice. Verified numbers and suggested interpretation are distinct. Hypothetical calculations only support the implemented deterministic tools; no claim of unrestricted accounting analytics.
- No GitHub change was made in this turn. The v022 and v023 patches must be applied together to v021, using the manifest and base hashes.
