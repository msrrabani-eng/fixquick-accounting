# Fix Quick v013 — Cancel vs. preserve a working draft

All draft-backed accounting dialogs (cheques, cash/bank/person transfers, receipts/payments, expenses, inventory operations, vouchers, people, and products) now include an explicit **لغو / خروج از عملیات** button. All new/edit invoice routes have **لغو فاکتور** and **لغو / خروج از فاکتور**.

A cancel dialog presents 3 distinct choices:

1. **خروج و حفظ پیش‌نویس:** save the current unfinished operation and exit; it remains in Home > عملیات نیمه‌تمام.
2. **لغو عملیات و حذف پیش‌نویس:** clear only this local draft, then exit; do not modify ledger, stock, other drafts, or committed documents.
3. **ادامه ویرایش:** close the dialog, retain the in-progress form.

The header X/back still uses existing save-and-exit behavior. Draft data remains local to the app; uninstalling or clearing app data can remove it. The feature must be smoke-tested on an Android device before production use.
