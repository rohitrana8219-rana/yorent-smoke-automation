# YoRent team smoke checklist

This is the business smoke entry point for the existing CommonJS/Chromium project. Module specs stay in their existing folders. `playwright.smoke.config.js` composes the original 36-test journey and two independent lifecycle branches; it does not copy those specs into this folder.

Run `npm run test:smoke:headed` to watch everything, or `npm run test:smoke` for headless execution. Use `npm run report:smoke` for its separate HTML report. Discovery: `npm run test:smoke -- --list` (60 tests, no browser or application mutations). Never share `.env`, `.auth/`, credentials, cookies, or browser states. This Markdown checklist is shareable; treat generated reports as internal QA material.

## Execution and prerequisites

Full order: original Admin setup/configuration/catalog -> Seller registration/approval/login/shop/catalog/inventory -> normal Buyer rental journey through Completed -> cancellation branch -> refund branch. One worker, zero retries, one Chromium process, separate Admin/Seller/Buyer contexts. Windows/tabs may still open and close with isolated contexts. All application records remain for review.

Each new branch uses a different Buyer and parent order with two rental lines (the Admin-created and Seller-created inventories). Each request is associated with its exact parent order, suborder, product, Buyer, and Seller. Source inventory is pinned to a completed original rental run, not an arbitrary latest application record.

Standalone commands do not create catalog/shop/inventory or execute unrelated modules:

```powershell
npm run test:smoke:cancel -- --source-run <completed-rental-run-ID>
npm run test:smoke:refund -- --source-run <completed-rental-run-ID>
```

If `--source-run` is omitted for a fresh standalone branch, the explicit local `.auth/rental/current.json` handoff is used and must reference a completed normal journey. Run `npm run test:rental:headed` first if no valid source exists. An explicit source ID is recommended for team reproducibility. A full smoke run creates its own prerequisites automatically.

The runner prints a smoke run ID. A normal invocation starts fresh records. To verify or resume that same branch safely, use `npm run test:smoke:cancel -- --run <smoke-ID>` or the corresponding refund command. `--run` is the smoke ID, not its internal branch rental ID. The manifest `.auth/smoke-checklist/<smoke-ID>.json` pins the source and two distinct per-branch run IDs. It contains only IDs; private account/state files remain under `.auth/rental/runs/<branch-ID>/`.

An uncertain submission records an intent before clicking. The runner never blindly retries a transfer. A saved exact approved/refunded request is reconciled against its own ledger entries without another approval; an absent or inconsistent result fails and leaves the guard in place. Starting a fresh run is not a way to reconcile an uncertain prior payment. Do not remove guards just to make tests pass. The shared rental/smoke execution lock prevents concurrent transaction commands.

## Checklist mapping

In the command column, **Full** means `npm run test:smoke:headed` (or `npm run test:smoke`). **Cancel** means `npm run test:smoke:cancel`; **Refund** means `npm run test:smoke:refund`. Each two-line scenario is instantiated separately for the exact Admin/Seller inventory; instances are not duplicate coverage of the same product.

| Scenario ID | Module / role | Scenario and expected persisted result | Automated spec / project | Tests | Command |
| --- | --- | --- | --- | ---: | --- |
| SC-N-01 | Authentication / Admin | Login succeeds, dashboard verified, separate Admin state saved | `tests/auth.setup.js`, `setup` | 1 | Full |
| SC-N-02 | Admin navigation / Admin | Eight existing navigation/control assertions | `tests/admin/navigation.spec.js` | 8 | Full; existing `test:authenticated` |
| SC-N-03 | Brand / Admin | Unique brand saved and retained | `tests/admin/brands.spec.js` | 1 | Full; `npm run test:brand` |
| SC-N-04 | Category / Admin | Navigation and unique category persistence | `tests/admin/categories.spec.js` | 2 | Full; `npm run test:category` |
| SC-N-05 | Tax Structure / Admin | Navigation and unique structure persistence | `tests/admin/tax-structure.spec.js` | 2 | Full; `npm run test:tax-structure` |
| SC-N-06 | Configuration/catalog / Admin | Own category, brand, tax class/rule, option, shipping rate and product saved; edit persists | `tests/admin/product-creation.spec.js` | 1 | Full |
| SC-N-07 | Registration / Seller | Unique account and business details submitted | `tests/seller/registration.spec.js` | 1 | Full; existing `test:seller-registration` |
| SC-N-08 | Seller approval / Admin | Exact Seller request verified/approved | `tests/admin/seller-approval.spec.js` | 1 | Full |
| SC-N-09 | Authentication / Seller | Separate Seller state after successful login | `tests/seller.auth.setup.js` | 1 | Full |
| SC-N-10 | Shop/shipping / Seller | Shop/profile/rate reload with saved values | `tests/seller/shop.spec.js` | 1 | Full |
| SC-N-11 | Catalog / Seller | Owned product saved and ownership retained | `tests/seller/product.spec.js` | 1 | Full |
| SC-N-12 | Catalog approval / Admin | Exact Seller product approved | `tests/admin/seller-product-approval.spec.js` | 1 | Full |
| SC-N-13 | Inventory / Seller | Both source products have saved sale/rental details, prices, shipping, and scan codes | `tests/seller/inventory.spec.js` | 2 | Full |
| SC-N-14 | Registration/login / Buyer | Unique Buyer ID/profile and separate login verified | `tests/rental/{registration,buyer-auth}.spec.js` | 2 | Full; existing Buyer commands |
| SC-N-15 | Wallet / Admin | Exact new Buyer credited once, completed ledger verified | `tests/rental/credit.spec.js` | 1 | Full; `npm run test:buyer:credit` |
| SC-N-16 | Rental booking / Buyer | Both products, future dates, qty, charges, wallet payment, saved parent/suborder IDs | `tests/rental/booking.spec.js` | 1 | Full; `npm run test:buyer:booking` |
| SC-N-17 | Order ownership / Seller | Correct Seller identity authenticated for the paid order | `tests/rental/seller-auth.spec.js` | 1 | Full |
| SC-N-18 | Fulfillment / Seller | Each exact line persists In Process -> Shipped -> Delivered | `tests/rental/fulfillment.spec.js` | 2 | Full; `npm run test:seller:fulfillment` |
| SC-N-19 | Rental hand-back / Buyer | Normal rental return details/status persist for both lines | `tests/rental/buyer-return.spec.js` | 2 | Full; `npm run test:buyer:return` |
| SC-N-20 | Rental receiving / Seller | Received qty/codes, date and security recommendation persist | `tests/rental/seller-return.spec.js` | 2 | Full; `npm run test:seller:return` |
| SC-N-21 | Completion / Admin + Buyer | Both Completed; two security refunds and final balance verified | `tests/rental/complete.spec.js` | 2 | Full; `npm run test:admin:complete` |
| SC-CAN-PREP | Independent cancellation order / Buyer + Admin | Separate Buyer, auth, controlled credit and paid order; original completed order is not reused | `tests/smoke-checklist/prepare-buyer.spec.js` plus reused Buyer auth/credit/booking specs, `smoke-cancel-*` | 4 | Full; Cancel |
| SC-CAN-01 | Cancellation / Buyer | Exact line, reason, comments, ID, Pending status and quoted calculation persist | `tests/smoke-checklist/cancellation-request.spec.js` | 2 | Full; Cancel |
| SC-CAN-AUTH | Cancellation ownership / Seller | Correct Seller authenticates | reused `tests/rental/seller-auth.spec.js` | 1 | Full; Cancel |
| SC-CAN-02 | Cancellation / Seller VIEW ONLY | Exact request visible; only View Order action is exposed; Seller never approves | `tests/smoke-checklist/cancellation-seller-view.spec.js` | 2 | Full; Cancel |
| SC-CAN-03 | Cancellation / Admin | Exact request approved; wallet destination verified; application quote equals unique credits | `tests/smoke-checklist/cancellation-admin-approve.spec.js` | 2 | Full; Cancel |
| SC-CAN-04 | Cancellation reconciliation / Buyer | Both Cancelled/Approved; exact reason/IDs persist; balance delta and unique refund/security entries match | `tests/smoke-checklist/cancellation-wallet.spec.js` | 1 | Full; Cancel |
| SC-REF-PREP | Independent refund order / Buyer + Admin | Different Buyer/order from normal and cancellation; auth, controlled credit and payment verified | shared prepare + reused Buyer auth/credit/booking specs, `smoke-refund-*` | 4 | Full; Refund |
| SC-REF-AUTH | Refund ownership / Seller | Correct Seller authenticates | reused `tests/rental/seller-auth.spec.js` | 1 | Full; Refund |
| SC-REF-01 | Refund fulfillment / Seller | Each exact line Delivered using existing verified transitions | `tests/smoke-checklist/refund-fulfillment.spec.js` | 2 | Full; Refund |
| SC-REF-02 | Direct Refund Request / Buyer | Qty 1, product, reason, message and exact saved request ID; no rental hand-back submitted | `tests/smoke-checklist/refund-request.spec.js` | 2 | Full; Refund |
| SC-REF-03 | Refund / Seller | Seller uses actual Approve Refund; Refunded persists; wallet belongs to original Buyer and credits reconcile | `tests/smoke-checklist/refund-seller-process.spec.js` | 2 | Full; Refund |
| SC-REF-04 | Refund reconciliation / Buyer | Both requests Refunded by Seller, total credits and wallet delta reconcile without duplicate IDs | `tests/smoke-checklist/refund-wallet.spec.js` | 1 | Full; Refund |

Counts: 36 original journey tests + 12 cancellation + 12 refund = **60 full smoke tests**. Standalone branches include their own Admin setup, so each discovers **13 tests**. A `--list` result is discovery evidence, not an execution pass.

## Coverage boundaries and observations

- Normal rental hand-back and Refund Request are different UI flows. Refund uses the delivered order's **Refunds** link and the Seller's **Approve Refund** action. Admin is not the required refund approver. Cancellation uses Buyer request -> Seller view only -> Admin approval.
- Cancellation refund is read from the application's quote, including its displayed security handling. No refund percentage is hardcoded. A tested quote was $55.81 excluding $25 security; the two wallet entries were checked separately. The percentage cannot simply be multiplied by the gross payment because taxes/penalties are application-calculated.
- The controlled refund branch checks full requested quantity and the Seller UI's displayed amount/components against actual wallet credits. It does not claim coverage of partial/disputed/damaged returns, deductions, gateway refunds, or alternate refund policies.
- Strict keyword filtering/relevance is not claimed. Existing booking uses the observed local 48-item search view and exact inventory IDs. Larger result sets that omit the target fail rather than choosing an arbitrary product.
- Refund detail pages showed PHP `strlen(null)` deprecation notices. During development UAT also returned a database connection fatal error; any affected money action remains guarded until the exact saved state and ledger are reconciled.
- Existing invalid-login tests, Commission module checks, independent Shipping checks, and the related tax suite remain separate commands. Their presence in the repository is not counted as full-checklist execution. No global commission, wallet, tax, refund, or language setting is changed.
- Real email delivery, external carrier operation, load/performance/stress, and destructive cleanup are not covered. All records remain in UAT.

## Validation status — 28 October 2026

- Cancellation preparation: **5 passed**. Complete independent cancellation replay: **13 passed, 0 failed, 0 skipped**. Both approvals and unique ledger credits verified. Earlier attempts found a cookie overlay and different terminal-status markup; both were corrected using actual UI evidence.
- Refund after UAT restoration: `npm run test:smoke:refund -- --run 39d6bf8e --headed` completed **13 passed, 0 failed, 0 skipped**. Requests 21/22 were verified Refunded and their unique $81.75 wallet entries reconciled. Both guards were cleared only after exact saved-state and ledger verification; approvals were not repeated.
- First full headed attempt (`cc315e24`): **51 passed, 1 failed, 8 did not run, 0 skipped**. All original 36 tests and all 12 cancellation checks passed. The refund booking stopped before payment because a price-breakup Close click raced Bootstrap's opening transition. The shared helper now waits for the actual modal shown event and hidden state. The blocked cart action was reconciled before resuming.
- `npm run test:smoke:refund -- --run cc315e24 --headed` then completed **13 passed, 0 failed, 0 skipped (2.5 minutes)**. New order O1793181931 and requests 23/24 passed, including the price modal, checkout, Seller approvals, and the $336.50 -> $418.25 -> $500.00 Buyer wallet reconciliation.
- UAT now emits canonical English links with an optional `/en` prefix. Public-route checks accept these observed forms while still requiring the configured origin, exact role/path/IDs, and `html lang=en`. No site language setting was changed.
- Original-command regression: `npm run test:rental:workflow`, run `022826cf`, **36 passed, 0 failed, 0 skipped (5.8 minutes)**. Buyer 276 / Seller 275, parent O1793182424, suborders 654/655 both Completed, payment $163.50 (W-1793182428), final wallet $386.50 after both $25 security refunds.
- Representative preserved commands: `npm run test:brand -- --reporter=list --output=test-results/backward-brand` **2/2 passed**; `npm run test:commission -- --reporter=list --output=test-results/backward-commission` **2/2 passed**, including setup in each. Commission checks were read-only. `npm run test:login -- --reporter=list --output=test-results/backward-login` **3/3 passed** in `chromium-unauthenticated`, with no setup dependency. All had 0 failed and 0 skipped.
- `node --check` passed for all **62 JavaScript files** in helpers/pages/tests/scripts and the Playwright configurations. `.env`, `.auth/`, and `smoke-report/` remain Git-ignored.
- Final full execution: `npm run test:smoke:headed`, smoke run `c12acd79`, **60 passed, 0 failed, 0 skipped, 0 did not run (10.4 minutes)**. This includes the original 36, all 12 cancellation checks, and all 12 refund checks together. Full discovery also lists 60 tests. The full headless smoke command is provided but was not separately executed; the original 36-test regression above ran headless.

Latest complete smoke records (Seller 277, catalog products 275/276, inventories 327/328):

| Flow / run | Buyer | Paid parent / suborders | Request IDs / final persisted result | Refund and wallet |
| --- | --- | --- | --- | --- |
| Normal rental / `c12acd79` | 278 | O1793182880 / 658, 659 | Normal hand-back; both Completed | $50 security returned; $336.50 -> $386.50 |
| Cancellation / `497e51d0` | 279 | O1793183051 / 662, 663 | Cancellation 20, 21; Admin Approved; both Cancelled | $80.81 each; $336.50 -> $417.31 -> $498.12 |
| Direct refund / `6ac979e8` | 280 | O1793183175 / 666, 667 | Refund 25, 26; both Refunded by Seller | $81.75 each; $336.50 -> $418.25 -> $500.00 |

All three parents were paid $163.50 from separate $500 Buyer credits. Payment references are W-1793182884 (normal), W-1793183055 (cancellation), and W-1793183178 (refund). Cancellation credits are TN-0000531/532 and TN-0000534/535, separately checking $55.81 refund and $25 security per line. Refund credits are TN-0000539 and TN-0000540 at $81.75 each, including security. Exact completed transaction rows, balances, Buyer ownership, and request persistence were asserted through the UI. All three run journals have no pending submission intent.

The smoke HTML report exists at `smoke-report/index.html`; open it with `npm run report:smoke`. The original rental report remains at `playwright-report/index.html`. The execution lock and temporary inspection-browser endpoint file are absent after cleanup. `git diff --check` passed (only Git line-ending normalization notices). No application records or global settings were removed/changed.

Independent branch evidence retained for QA:

| Smoke / branch run | Buyer / Seller | Paid parent / suborders | Requests / result | Application refund and wallet |
| --- | --- | --- | --- | --- |
| `39d6bf8e` / `f53f21e2` cancellation | 269 / 265 | O1793176205 / 634, 635 | 16, 17; Approved by Admin, orders Cancelled | $80.81 each ($55.81 + $25 security); $336.50 -> $417.31 -> $498.12 |
| `39d6bf8e` / `67e26ab9` refund | 270 / 265 | O1793176651 / 638, 639 | 21, 22; Refunded by Seller | $81.75 each; TN-0000485, TN-0000505; $336.50 -> $418.25 -> $500.00 |
| `cc315e24` / `8a84da4c` cancellation | 273 / 271 | O1793178714 / 646, 647 | 18, 19; Approved by Admin, orders Cancelled | $80.81 each; $336.50 -> $417.31 -> $498.12 |
| `cc315e24` / `7f30c1d8` refund | 274 / 271 | O1793181931 / 650, 651 | 23, 24; Refunded by Seller | $81.75 each; TN-0000507, TN-0000508; $336.50 -> $418.25 -> $500.00 |

Each parent above was paid $163.50. Cancellation run `f53f21e2` has unique refund/security transaction pairs TN-0000477/478 and TN-0000482/483; `8a84da4c` has TN-0000498/499 and TN-0000501/502. Branch journals have no pending submission intents after reconciliation. Records and their synthetic accounts remain in UAT.

See `PROJECT_GUIDE.md` for the broader existing project and append-only validation/record evidence. Update this status only from actual command output.
