# Fix Quick v012 — automatic recoverable drafts

- Invoice routes (`#/new/sale`, `#/new/purchase`, returns, edits): save all item rows and form inputs when changing screens, on edits and when the app is backgrounded. Return from inventory using the green shortcut.
- Dialogs: receipt/payment, person-to-person transfer, bank/cash transfer, cheque and instalment, expense retain local drafts when closed. Home shows saved unfinished operations.
- Drafts are scoped by the signed-in user + flow key and never written into accounting journal `S` or IndexedDB. Existing finalized accounts/invoices/database are untouched.
- A draft clears only after a successful save/commit; invoice form has explicit discard with confirmation. Drafts are not transferred as part of accounting backups.
- On-device UI integration needs to be verified on Android APK, especially after the app is backgrounded or after hardware back navigation.
