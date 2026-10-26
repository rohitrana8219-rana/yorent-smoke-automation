# YoRent Playwright project guide

This guide explains the code in this existing project. It is written for a manual QA engineer who needs to run the tests and explain them in a presentation. The project uses JavaScript, CommonJS, Playwright Test, Chromium, and dotenv. It does not use TypeScript or call application APIs to create test records.

## 1. What the project covers

- Three independent admin login tests: valid login, invalid login, and the dashboard.
- Eight admin navigation checks, plus Category, Brand, and Tax Structure creation and persistence.
- An admin catalog workflow that creates its own category, brand, tax structure, tax category, tax rule, option/value, shipping profile/rate, and product. It edits the product model and verifies the saved data.
- Public seller registration and business activation.
- A check of the new seller's admin approval request. Pending requests are approved only for the new test seller; already Approved requests are verified without changing them.
- A separate seller login session, shop setup, and seller shipping profile/rate.
- Seller-owned catalog product creation, followed by an admin ownership check, approval, and fulfillment setup.
- Sale and rental inventory for both the admin catalog product and the seller-owned catalog product.

The current execution results are recorded at the end of this guide. Implemented code alone is not evidence that a test passed.

## 2. Folder structure

```text
Commercial Automation/
  playwright.config.js          Project matching, browser settings, and dependencies
  package.json                  Existing npm commands plus test:workflow
  pages/
    LoginPage.js                Existing admin login page object
    SellerLoginPage.js          Public seller login page object
  helpers/
    workflow-data.js            Private handoff files and safe record summaries
    catalog-ui.js               Catalog dropdowns, options, and save navigation
    shipping-ui.js              Shipping profile and rate UI steps
    inventory-ui.js             Repeated sale/rental UI steps and saved-value checks
  tests/
    auth.setup.js               Existing admin authentication setup
    seller.auth.setup.js        Independent seller authentication setup
    admin/                     Login, navigation, configuration, catalog, approvals
    seller/                    Registration, shop/shipping, product, inventory
    buyer/README.md             Reserved for future buyer coverage
    sanity.spec.js              Old blank-page example; current projects do not select it
  docs/
    application-inventory.md    Earlier application observations
    smoke-automation-plan.md    Existing 28-item checklist mapping
    PROJECT_GUIDE.md            This guide
  .env                         Private admin credentials and client base URL
  .auth/                       Private browser states and generated workflow data
  test-results/                Test artifacts, including nonsecret record summaries
  playwright-report/           HTML report
```

The earlier `tests/authenticated/` admin specs were moved into `tests/admin/`. The inactive older admin Tax Structure copy was consolidated into the current tested version, so the same two scenarios are not duplicated. The original 13 feature tests and the three login tests remain. The additional catalog-product scenario already existed before this workflow extension.

## 3. Configuration in simple English

`require('dotenv').config()` loads the private local environment. The configuration validates `YORENT_BASE_URL` before a run. It must be an HTTP or HTTPS origin, without a username, password, extra path, query, or hash. Tests navigate to paths such as `/admin/home`, so the client host is not repeated throughout the code.

`testDir: './tests'` is the root folder in which Playwright looks for tests. Each project then uses `testMatch` and `testIgnore` to select its own files. All projects use Chromium.

The existing `chromium-unauthenticated` project selects only `tests/admin/login.spec.js`. It has no setup dependency and no storage state. This allows the login tests to test the real login form independently.

`chromium-authenticated` selects the admin feature files and depends on `setup`. It excludes login and the two later approval files, which belong to their own workflow stages. It loads `.auth/admin.json`.

The seller projects load `.auth/seller.json`. Public registration and seller authentication start with fresh contexts. An admin session is never used to execute a seller test.

The list reporter shows progress in the terminal. The HTML reporter writes a report without opening it automatically. Existing admin failure screenshots and traces remain configured. New registration, seller authentication, and seller workflow projects disable screenshots/traces because pages and input actions can contain generated account details.

## 4. Workflow order

Playwright project dependencies enforce this order:

```text
setup
  -> chromium-authenticated (admin configuration and catalog smoke)
  -> seller-registration
  -> chromium-seller-approval
  -> seller-setup
  -> chromium-seller-shop
  -> chromium-seller-product
  -> chromium-product-approval
  -> chromium-seller (two inventory tests)
```

`chromium-unauthenticated` remains independent of this chain. File names and alphabetical order do not establish dependencies. The two inventory tests use different catalog products and can each be selected independently after their required data exists.

If a dependency fails, Playwright does not run the projects that depend on it. This protects later steps from using incomplete prerequisites. `.auth/admin-workflow.json` also records `complete: true` only after the admin product workflow finishes all its UI checks. Seller tests check this flag and the target origin before using those record IDs.

The final project selects 23 tests through its dependencies: 15 admin/setup tests plus eight new seller workflow/setup/approval tests. The three independent login tests bring the full default suite to 26 tests.

## 5. Admin and seller authentication

The existing `tests/auth.setup.js` first removes any old `.auth/admin.json` with `fs.rmSync(authFile, { force: true })`. `force: true` allows the file to be absent. Missing admin environment variables throw an error rather than skip setup. The setup uses `LoginPage`, logs in, verifies `/admin/home`, and only then saves browser storage state.

The seller registration test generates a unique account. It saves the account privately before submitting it, so details are retained even if a later step fails. The latest account is in `.auth/seller-account.json`; a separate `.auth/seller-account-<suffix>.json` archive is kept for every account created by the automation. Do not paste these files into a presentation, chat, or report.

`seller.auth.setup.js` removes any old seller state, checks that registration completed, uses `SellerLoginPage`, verifies `/seller`, and then saves `.auth/seller.json`. It does not copy admin cookies. Both state files and the account handoff files are covered by the existing `.auth/` Git ignore rule. `.env` is also ignored.

The current tenant has email verification disabled, as confirmed by the project owner and the observed registration flow. Generated demo email addresses use the reserved `example.com` domain. No mailbox or OTP service was used. If the tenant enables email/OTP verification, stop at that UI requirement and provide authorized access; do not bypass it.

## 6. Data generation and retention

Names contain a short random hexadecimal suffix, for example `QA Tools <suffix>` or `QA Seller Drill <suffix>`. Short names avoid the earlier Tax Structure field-length problem. Identifiers and URL keywords use the same suffix to keep records easy to find.

The seller phone is from the US 202-555-01xx example-number range. Addresses and product details are demo data. The seller UI rejects password symbols in this tenant, so the generated private password is alphanumeric.

All demo records are retained. The creation specs no longer have delete or cleanup actions. `finally` blocks record names, IDs, and submission state instead of removing records. Failure does not trigger deletion. The known retained Tax Category 51 is never selected for cleanup.

`attachRecords()` accepts only the nonsecret record summaries supplied by a test. It writes them to the terminal and attaches JSON to the report. The account object itself is never passed to it. `fillPrivate()` replaces an input failure with a generic error so private account input values are not included in the error message.

The inventory helper records progress in the private handoff file. If an inventory check is rerun with its existing data, it finds and verifies its own retained rental inventory and can complete its sale setup. It does not replace existing rental scan codes or delete inventory.

Admin workflow metadata is also archived as `.auth/admin-workflow-<suffix>.json`, so names and IDs remain available after the latest-run handoff file changes. A new sale form can display Publish = Yes before a save; the helper uses its recorded saved phase and reloaded UI values rather than treating that default as proof of persistence.

## 7. How UI verification works

The tests use actual forms, links, dropdown options, and observed application behavior. They do not create records by calling application endpoints. Some tests observe a browser response to know that a UI search or save has finished; that does not replace the UI action or the saved-value checks.

Examples:

- `expect(page).toHaveURL(...)` confirms the expected page was reached.
- `toHaveCount(1)` confirms the unique generated record is present once.
- `toHaveValue(record.id)` confirms a saved association points to the intended category, brand, tax category, or shipping profile.
- Reloading a form and checking its fields proves the values survived a fresh UI load.
- The admin listing verifies the admin product is Admin-owned and Approved.
- The admin approval test verifies the new seller product belongs to the new seller before changing its approval checkbox.
- Seller inventory lists and edit forms verify catalog associations, Standard option, quantities, active status, prices, rental duration, security amount, buffer, condition, and shipping profile.

The tests use Playwright's locator waiting and assertions. There are no fixed sleeps or speculative retry loops.

## 8. Important code to explain

| Code | Why it exists |
| --- | --- |
| `dependencies: ['setup']` | Admin features wait for successful admin authentication. |
| `storageState: ...admin.json` / `...seller.json` | Each role receives its own saved session in a fresh browser context. |
| `randomBytes(4).toString('hex')` | Generates short unique demo names. |
| `complete: true` in admin workflow data | Later projects require a fully verified catalog prerequisite. |
| `saveCatalogForm()` waits for main-frame navigation | An edit can save to the same URL; checking the URL alone could finish before the save. |
| `prod_options[]` assertion | Verifies the product's saved option association; the option picker can reset after adding a tag. |
| `getByPlaceholder('Daily Rental Price')` | Variant selection changes field names; the observed visible placeholder remains stable. |
| `#ui-datepicker-div .ui-datepicker-today a` | Chooses a valid date through the real read-only date picker. |
| `#savecode` | The visible Continue control has `aria-label="Close"`, so a button-name query for Continue does not match it. |
| Numeric sale SKU | The sale form explicitly requires an integer, while rental CODE-128 scan codes accept the generated codes. |
| Buffer Hours = `1` | The real form validates a range of 1 to 365. Zero is rejected. |
| Record-summary `finally` blocks | Preserve evidence and leave created data available after failures. |

The current shop offers Ship Only until pickup addresses are configured. The catalog and inventories use the supported Ship Only setting. The seller-owned product initially appears Un-approved and has no fulfillment value in the admin form; the explicit admin product stage sets Ship Only and verifies approval after reload.

The sale tab for a seller-owned catalog also exposes a required `fulfillment_method` dropdown. It is not present for the shared admin catalog in this tenant. The helper fills and verifies this field when the real form includes it.

## 9. Running tests

Run commands from the project folder. Use the existing installed dependencies. Set private admin credentials and the client origin in `.env`; do not put them on the command line.

```powershell
npm run test:login
npm run test:authenticated
npm run test:workflow
npm test
npm run report
```

| Command | What it runs |
| --- | --- |
| `npm run test:login` | Three independent admin login tests. |
| `npm run test:authenticated` | Admin setup and 14 admin feature/catalog tests. |
| `npm run test:workflow` | The complete ordered 23-test Admin-to-Seller chain. |
| `npm test` | All configured projects, including the login tests and workflow. |
| `npm run report` | Opens the existing HTML report. |

Discovery without execution:

```powershell
npm run test:workflow -- --list
```

A focused admin example, including its setup dependency:

```powershell
npm run test:authenticated -- tests/admin/brands.spec.js
```

For a focused later-stage investigation, `--no-deps` may select only that project after its current data and session have already been verified. It bypasses prerequisites and must not be used as evidence that the complete chain passed. A fresh full workflow run generates new demo data and retains it.

## 10. Known defects and limitations

### Unresolved Tax Category deletion defect

Tax Category **ID 51, QA Tax Class 9e68c6d7**, previously failed deletion with **Please Unlink All The Products First** even after its linked product was deleted and confirmed absent from the product listing. The backend was not inspected. This session does not retry its cleanup or delete that category.

The earlier product-creation workflow must not be described as fully passing: its cleanup failed. The current retention workflow has different behavior because it deliberately keeps products and prerequisites. Passing it does not prove the deletion defect is fixed.

### Coverage boundaries

- The observed admin and seller shipping rate forms expose cost and minimum shipping duration. Distance-based pricing and a maximum duration were not exposed in these forms and are not claimed as covered.
- The current seller registration is automatically Approved. The pending-approval control was inspected without changing another seller, but that branch must be distinguished from an actually executed manual approval.
- Buyer, checkout, payment, order lifecycle, and frontend availability workflows have not been implemented here.
- Combined Tax creation, Flexi Payment calculations, and the other conditional checklist items are not implied by this smoke workflow.
- `docs/smoke-automation-plan.md` contains the existing 28-item mapping. A separate original checklist document was not found. Its older cleanup recommendations are superseded by the current instruction to retain every demo record.
- Some earlier documentation is stale: the verified admin dashboard is `/admin/home`, and the current page object already uses relative navigation with a validated base URL.
- Browser launch and worker creation are blocked by the execution sandbox in this environment. Authorized verification runs use elevated execution to allow local Chromium and workers to start.

## 11. Presentation walkthrough

1. Open `playwright.config.js`. Explain test discovery, Chromium, separate role sessions, and the dependency chain.
2. Open `pages/LoginPage.js` and `pages/SellerLoginPage.js`. Show how locators and login actions are kept in page objects.
3. Open `tests/auth.setup.js`. Explain stale-state removal and saving state only after the dashboard check.
4. Open `tests/admin/product-creation.spec.js`. Follow the named steps from configuration records to product creation, edit, reload, and listing checks.
5. Open `tests/seller/registration.spec.js` and the admin approval test. Explain unique data and conditional approval without displaying the private account files.
6. Open the shop, seller product, and inventory tests. Explain ownership, options, shipping associations, rental settings, numeric sale SKU, and saved-value checks.
7. Run `npm run test:workflow -- --list` to show scope without creating records. Show the recorded execution results or HTML report for actual outcomes.
8. Find a retained demo product by its short identifier in the application. End by explaining the unresolved deletion defect and remaining coverage.

## 12. Likely questions and answers

**Why use storage state?** The setup logs in once for each role. Feature tests start with that verified session and focus on the business workflow. Login tests still use the real unauthenticated form.

**Do tests share the same page?** No. Playwright creates a new context/page for each test. The role's storage state provides authentication. Only record IDs and workflow data are passed through private local files.

**Why use dependencies?** A seller cannot use an unfinished catalog or an unapproved account. Dependencies enforce the required stages without depending on file-name order.

**How do we know data was saved?** Tests reload forms, reopen inventory, search lists, and assert saved values and association IDs.

**Why keep records?** They are demonstration data for manual verification. The current instruction is to retain everything, including partial records after a failure.

**Does an HTTP 200 prove success?** No. Responses only help synchronize a UI operation. Assertions on reloaded forms and listings verify the result.

**Does a passing retained-product test resolve the Tax Category bug?** No. No deletion is performed, so that defect remains unresolved.

**Can this run against another client?** The base URL is configurable, but locators, enabled features, approval settings, and required form fields must match that client's UI. Do not claim unsupported features passed.

## 13. Execution evidence and retained records

Execution date: **26 October 2026**, Asia/Calcutta.

The commands below used the project's existing installation. No dependency installation or application/backend changes were made. Private credentials and browser state contents are excluded.

| Exact test command | Actual result |
| --- | --- |
| `npm run test:login` | 3 passed, 0 failed, 0 skipped. |
| `npm run test:authenticated` | 14 passed, 1 failed: Brand reached the 30-second test limit after a slow dashboard load. |
| `npm run test:authenticated -- tests/admin/brands.spec.js` | 2 passed, including setup, after waiting for DOM content instead of all dashboard assets. |
| `npm run test:workflow -- --list` | 23 tests discovered in 13 files; no tests executed. |
| `npm run test:workflow` (first integrated attempt) | 14 passed, 1 failed, 8 did not run because the catalog dependency failed. The shipping language save succeeded, but the helper waited for the wrong response controller. |
| `npm run test:authenticated -- tests/admin/product-creation.spec.js` | 2 passed after matching the observed `/lang-setup` response. |
| `& .\node_modules\.bin\playwright.cmd test --project=seller-registration --no-deps` | 1 passed. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-seller-approval --no-deps` | 1 passed; the new request was already Approved. |
| `& .\node_modules\.bin\playwright.cmd test --project=seller-setup --no-deps` | 1 passed; independent seller state saved. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-seller-shop --no-deps` | 1 passed. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-seller-product --no-deps` | 1 passed; product initially Un-approved. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-product-approval --no-deps` | 1 passed; ownership and saved approval verified. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-seller --no-deps` (first attempt) | 2 failed: the helper mistook a new sale form's Publish = Yes default for a completed save. Rental records were retained. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-seller --no-deps` (resume after correction) | 1 passed, 1 failed. Admin-product inventory passed; seller-owned sale validation reported `Fulfillment Method Is Mandatory`, so no sale save request was sent. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-seller --no-deps -g 'for the seller catalog product'` | 1 passed after filling and checking the actual conditional fulfillment field. Existing inventory and rental scan codes were preserved. |
| `npm run test:workflow` (final integrated attempt) | **23 passed (2.5 minutes), 0 failed, 0 skipped, 0 blocked by dependencies.** |

All JavaScript files under `tests/`, `pages/`, and `helpers/`, plus `playwright.config.js`, were checked with `node --check`. A source search found no record-deletion actions or fixed sleeps in the active test/helper/page code. The earlier Brand diagnostic that tried to read a closed page was removed; the original row assertion remains and does not dump full page text.

### Retained records from investigation and focused runs

These are real records created during this session, including incomplete-run prerequisites. No record is claimed created merely because a name was generated.

| Group | Retained names and IDs |
| --- | --- |
| First admin smoke | `QA Brand 658cf52a` **110** (confirmed through the UI after its test timed out); `QA Category e63c80ff` **101**; `QA-26974882ba89` Tax Structure **84**. |
| First catalog run, suffix `e7366c23` | `QA Tools e7366c23` Category **102**; `QA Brand e7366c23` **111**; `QA Tax e7366c23` Structure **83**; `QA Tax Class e7366c23` **53**; `QA Rule e7366c23` **16**; `Cordless Drill e7366c23` Product **248**. |
| Focused Brand rerun | `QA Brand 654632fc` **112**. |
| UI inspection configuration | `QA Ship bfac3edd` Shipping Profile **64**, Zone **69**, `QA Delivery bfac3edd` Rate **75**; `QA Size 7803f363` Option **18**, Standard value **27**. |
| First UI-driven seller | `QA Seller 7803f363` User **252**, Request **218**, reference `252-1793003312`; `QA Shop 7803f363` **55**; `QA Seller Ship 7803f363` Profile **66**, Zone **71**, Rate **77**; `QA Seller Drill 7803f363` Product **249**; `QA Drill Rent 7803f363` sale/rental Inventory **304**. |
| First integrated admin smoke | `QA Brand 10aed04b` **113**; `QA Category 505f0ccc` **104**; `QA-d8ae8c7aefa0` Tax Structure **86**. |
| Catalog prerequisites retained after shipping synchronization failure, suffix `f766727d` | `QA Tools f766727d` Category **103**; `QA Brand f766727d` **114**; `QA Tax f766727d` Structure **85**; `QA Tax Class f766727d` **54**; `QA Rule f766727d` **17**; `QA Size f766727d` Option **19**; `QA Ship f766727d` Profile **67**, Zone **72**, `QA Delivery f766727d` Rate **78**. The product step was not reached, so no product is claimed for this group. |
| Passing focused catalog, suffix `c75ed9df` | `QA Tools c75ed9df` Category **105**; `QA Brand c75ed9df` **115**; `QA Tax c75ed9df` Structure **87**; `QA Tax Class c75ed9df` **55**; `QA Rule c75ed9df` **18**; `QA Size c75ed9df` Option **20**; `QA Ship c75ed9df` Profile **68**, Zone **73**, `QA Delivery c75ed9df` Rate **79**; `Cordless Drill c75ed9df` Product **250**. |
| Passing focused seller workflow, suffix `f37c2d1a` | `QA Seller f37c2d1a` User **253**, reference `253-1793005649`; `QA Shop f37c2d1a` **56**; `QA Seller Ship f37c2d1a` Profile **70**, Zone **75**, `QA Seller Rate f37c2d1a` Rate **81**; `QA Seller Drill f37c2d1a` Product **251**; `QA Admin Stock f37c2d1a` sale/rental Inventory **305**; `QA Seller Stock f37c2d1a` sale/rental Inventory **306**. Both inventory checks passed after the focused fixes. |

The application also creates default Order Level Shipping data for a new seller. The custom profiles above are the profiles deliberately configured and verified by this workflow. Passwords, login usernames, email addresses, tokens, and browser-state contents are not included in this record list.

### Final integrated run records

| Record | Verified retained name | ID |
| --- | --- | --- |
| Standalone Brand smoke | `QA Brand b3e44d33` | 116 |
| Standalone Category smoke | `QA Category 57aff877` | 106 |
| Standalone Tax Structure smoke | `QA-ddcd13cd855c` | 89 |
| Catalog Category | `QA Tools 05bc8d25` | 107 |
| Catalog Brand | `QA Brand 05bc8d25` | 117 |
| Catalog Tax Structure | `QA Tax 05bc8d25` | 88 |
| Catalog Tax Category | `QA Tax Class 05bc8d25` | 56 |
| Catalog Tax Rule | `QA Rule 05bc8d25` | 19 |
| Product Option | `QA Size 05bc8d25`, with Standard value | 21 |
| Admin Shipping Profile | `QA Ship 05bc8d25` | 71 |
| Admin Shipping Zone | Default Rest Of The World zone for profile 71 | 76 |
| Admin Shipping Rate | `QA Delivery 05bc8d25`, $12.50, 2 days | 82 |
| Admin Catalog Product | `Cordless Drill 05bc8d25`, identifier `QA-DRILL-05bc8d25` | 252 |
| Seller Account | `QA Seller a540cba3`; request reference `254-1793006405`, Approved | 254 |
| Seller Shop | `QA Shop a540cba3` | 57 |
| Seller Shipping Profile | `QA Seller Ship a540cba3` | 73 |
| Seller Shipping Zone | Default Rest Of The World zone for profile 73 | 78 |
| Seller Shipping Rate | `QA Seller Rate a540cba3`, $9.50, 2 days | 84 |
| Seller-owned Catalog Product | `QA Seller Drill a540cba3`, identifier `QA-SDRILL-a540cba3`, Approved | 253 |
| Admin-product Sale/Rental Inventory | `QA Admin Stock a540cba3` | 307 |
| Seller-product Sale/Rental Inventory | `QA Seller Stock a540cba3` | 308 |

Both inventories were reopened and verified with quantity 3, hourly rental price $5, daily rental price $15, monthly rental price $200, sale price $199.99, active status, saved dates, shipping association, and their retained rental scan codes. Private account details remain in ignored account archives.

The tested Admin-to-Seller workflow is complete. The pending seller-request approval branch was not needed because the new requests were already Approved. Distance-based shipping, future buyer coverage, and the historical Tax Category deletion defect remain the limitations described above. No application records were intentionally deleted during this session.
