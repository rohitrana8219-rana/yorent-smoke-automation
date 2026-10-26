# YoRent Smoke Automation Plan

## Approach and assumptions

- Run against an isolated client test tenant and dedicated test accounts. Never create, edit, or delete client-owned records.
- Estimates below are rough active execution time per scenario, excluding test-data/environment preparation. They are planning estimates, not measured runtimes.
- **Source discrepancy to resolve:** `application-inventory.md` lists the successful admin URL as `/admin`, while the current login test and supplied project summary use `/admin/home`. Confirm the canonical dashboard URL before relying on dashboard assertions.
- Checklist item 3 says “user” without specifying a role. The table uses Buyer/User provisionally; confirm which user role is intended.
- Conditional Automation means automation depends on stable access, controlled test data, or an isolated/sandbox configuration. Manual means keep human verification for now.

## Checklist mapping

| # / scenario | Priority / suitability | Role; test data and preconditions | Main expected result | Dependencies | Est. |
|---|---|---|---|---|---:|
| 1. QC build-version match | P0 / Manual | QC; QC Request build number and Admin Panel access | Requested build matches the displayed Admin Panel version | QC request and target build available | 1–2m |
| 2. Seller registration email | P1 / Manual | Seller; unique registration data and accessible mailbox | Seller registers and confirmation email is received | Email service and mailbox access | 5–10m |
| 3. Valid user login | P0 / Conditional Automation | Buyer/User (confirm role); provisioned active account and credentials | Valid username/email and password allow login | Account provisioned | 2–4m |
| 4. Add Brand, Category, Product Options | P1 / Conditional Automation | Admin; uniquely named test records | Each configuration record is added | Admin access | 4–8m |
| 5. Distance-based shipping profile | P1 / Conditional Automation | Admin; base price and valid minimum/maximum durations | Profile is created with the configured values | Admin access; supported test values confirmed | 3–6m |
| 6. Admin product creation and catalog CRUD | P1 / Conditional Automation | Admin; uniquely identified test product(s), safe to edit/delete | Add through both Dashboard → Catalog → Products and plus (+); view, edit, and delete test-owned products | #4; shipping setup if required by product form | 6–12m |
| 7. Commission configuration and transaction | P2 / Manual | Admin, Seller, Buyer; approved commission value and sandbox transaction data | Commission can be configured/edited and is reflected in a transaction | Accounts, products, and safe payment setup | 10–20m |
| 8. Single and Combined Tax | P1 / Conditional Automation | Admin; approved test tax values in isolated tenant | Both tax structures can be created | Admin access; avoid changing live tax settings | 5–10m |
| 9. Rental durations and display | P1 / Conditional Automation | Admin, Seller; at least one duration; rental product | Duration is enabled and details appear in Seller Inventory and frontend | #4 and rental product from #13, or seeded equivalent | 5–10m |
| 10. Seller shop setup | P1 / Conditional Automation | Seller; dedicated account and approved shop data | Seller can set up shop | Seller account from #2 or pre-provisioned | 5–10m |
| 11. Scan-code type in inventory detail | P2 / Conditional Automation | Seller; product and available scan-code choices | Selected type appears in Product Inventory Detail | #10 and product from #13 or seeded equivalent | 3–6m |
| 12. Seller shipping profile | P1 / Conditional Automation | Seller; test profile values | Profile is created through the specified Shipping Profile path | #10; shipping values confirmed | 3–6m |
| 13. Sale and rental marketplace products | P1 / Conditional Automation | Seller; test sale/rental products and required catalog data | Products are added through the plus (+) icon in both specified inventory areas | #4, #9 where rental duration is required, #10 | 6–12m |
| 14. Holiday and frontend shop availability | P2 / Conditional Automation | Seller, Buyer; dedicated future test date and shop | Holiday/event is recorded and shop appears inactive on frontend for that date | #10; date availability and cleanup confirmed | 5–10m |
| 15. User dashboard and links | P0 / Conditional Automation | Buyer/User (confirm role); provisioned account | Dashboard is accessible, displays no errors, and links work | #3; dashboard URL and expected links confirmed | 3–6m |
| 16. Search availability for rental dates | P0 / Conditional Automation | Buyer; available product and selectable test dates | Search results reflect selected dates and product availability | #13 or seeded product; availability data | 3–6m |
| 17. Rental order with add-ons to Cart | P1 / Conditional Automation | Buyer; rentable product, add-on, and available dates | Buyer submits rental from product detail and reaches Cart | #13 and #16; add-on and date data | 5–10m |
| 18. Order statuses on calendar | P2 / Conditional Automation | Seller/Admin; controlled orders across applicable statuses and dates | Applicable daily statuses appear under correct dates; Completed, Cancelled, and Refunded are excluded | Orders from #17 and lifecycle scenarios; status data | 5–10m |
| 19. Flexi Payment conditions | P2 / Conditional Automation | Admin, Seller, Buyer; feature enabled, seller upfront value set, rental over 30 days | Flexi Payment appears only when all stated conditions hold | Feature/config access, seller/product, >30-day dates | 6–12m |
| 20. Price Breakage calculation | P2 / Manual | Buyer; order with known upfront-payment inputs and rental dates | Select Fulfilment Method shows an accurate upfront amount breakdown | #19 conditions; approved expected calculation | 5–10m |
| 21. Cancellation request | P1 / Conditional Automation | Buyer; order in Payment Confirmed status | Buyer can submit cancellation request | Order in required state; create via #17 or seed | 3–6m |
| 22. Return request | P1 / Conditional Automation | Buyer; order in Delivered or Picked status | Buyer can submit return request | Order and seller/admin status transition | 3–6m |
| 23. Extend delivered order | P2 / Conditional Automation | Buyer; order marked Delivered and valid extension dates | Buyer can extend the order | Order from #17; seller marks Delivered | 4–8m |
| 24. Sale and rental RFQ | P1 / Conditional Automation | Buyer; sale and rental products eligible for RFQ | Buyer can place RFQ for both product types | #13 or seeded eligible products | 5–10m |
| 25. Seller payment request | P2 / Manual | Seller; order with pending amount and payment-request access | Request is logged with a Pay Now option | Order/payment setup; safe sandbox required | 5–10m |
| 26. Buyer pays requested or custom amount | P2 / Manual | Buyer; pending request and approved sandbox payment method | Buyer can pay requested amount or a custom amount using the payment-log Pay button | #25; sandbox payment flow | 5–10m |
| 27. Amount ledger and pending balance | P2 / Manual | Buyer; order with known ledger and remaining amount | Ledger displays amounts and pending amount updates after payment | #26; controlled payment data | 4–8m |
| 28. Complete order and account breakdown | P2 / Conditional Automation | Admin, Buyer; controlled order and known amount breakdown | On Complete status, user account displays the correct amount breakdown | Order/payment scenarios #17 and #27 | 4–8m |

## Minimum P0 suite after each installation

Run the smallest practical set with pre-provisioned accounts and data:

1. **#1 — QC build-version match:** manual release gate.
2. **#3 — Valid login:** verify a designated user account can sign in.
3. **#15 — Dashboard and essential navigation:** verify access, no visible errors, and agreed key links.
4. **#16 — Product search:** use an existing available product and safe test dates to verify results.

These cover version identity, access, essential navigation, and one read-only core buyer workflow. Items #3, #15, and #16 are conditional until roles, routes, data, and stable assertions are confirmed. The rough active execution estimate is **9–18 minutes** for these checks; it has not been measured and is not a runtime guarantee. Track actual runtime on representative client installations before accepting the 30-minute target.

Keep setup separate from execution: provision/verify accounts, test product and availability, client URL, and mailbox or sandbox access before starting the timer. Setup time varies by client and is not included in the estimate.

## Selective suites

- **Admin Configuration:** #4, #5, #6, #8, #9. Run in an isolated tenant; configuration changes may affect other workflows.
- **Seller Inventory and Shop:** #2, #10, #11, #12, #13, #14. #2 email receipt remains manual; prioritize record cleanup and date-specific setup.
- **Buyer Rental Flow:** #16, #17, #19, #20, #24. Include Flexi Payment and financial calculations only with approved test data.
- **Orders and Calendar:** #18, #21, #22, #23, #28. Seed or create controlled orders in the required states.
- **Payments, Commission, and Ledger:** #7, #25, #26, #27, #28. Keep manual until sandbox payment behavior and expected amounts are repeatable.
- **Conditional features / release checks:** #1, #2, #9, #14, #19, #20. These depend on QC evidence, email access, calendar dates, feature settings, or verified calculations.

## Automation and test-data safeguards

- Automate deterministic UI paths and visible outcomes first. Keep build-number comparison, email receipt, payment execution, and calculation sign-off manual until evidence and test environments make them reliable.
- Use dedicated test accounts, unique record names (for example, a run/date prefix), known product availability, and approved non-production payment methods.
- Create only records owned by the test run. Do not delete or modify existing client records. Clean up only identified test-created records where safe; restore global settings changed by a scenario.
- Avoid running scenarios that alter commission, tax, rental-duration, Flexi Payment, or shop availability on a live client environment without explicit approval and a rollback plan.
- Keep credentials in the ignored `.env`; never print them in test output or documentation.

## Reusable client-domain configuration

The current `LoginPage.goto()` contains the test domain, and URL assertions contain an absolute dashboard URL. After plan review, the minimal reuse change is:

1. Set `YORENT_BASE_URL` per client in the local ignored `.env` (scheme and host only).
2. Add `use.baseURL: process.env.YORENT_BASE_URL` to the existing Playwright config, with a clear validation/default policy agreed before implementation.
3. Change page navigation to a path relative to `baseURL` and build URL assertions from the same base URL rather than embedding the current domain.

Do not put client credentials in source control. Validate configuration before running against a client so a missing or incorrect base URL cannot send tests to an unintended environment.

## Small next implementation steps

1. Confirm the canonical admin dashboard path (`/admin` versus `/admin/home`) and the intended role for checklist item 3.
2. Review and approve this plan; identify a safe client test tenant, dedicated accounts, seeded product, and cleanup policy.
3. Add `YORENT_BASE_URL` support with focused changes to configuration, `LoginPage`, and URL assertions.
4. Implement only the P0 checks first; measure execution and setup separately and review failures before adding selective scenarios.
5. Add the next deterministic scenarios in small groups, keeping email, payment, and risky configuration checks manual until reliable test data and rollback are confirmed.
