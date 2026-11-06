# YoRent Playwright project guide

This guide explains the code in this existing project. It is written for a manual QA engineer who needs to run the tests and explain them in a presentation. The project uses JavaScript, CommonJS, Playwright Test, Chromium, and dotenv. It does not use TypeScript or call application APIs to create test records.

Quick choice: run `npm run test:brand` for one module, `npm run test:tax-suite` for related tax modules, or `npm run test:workflow:headed` to watch the original Admin/Seller workflow sequentially. Section 15 describes the Buyer rental commands, prerequisites, and separate full rental workflow. Add `-- --headed` to a module or stage command to watch that smaller check. Section 14 contains earlier module validation; section 13 is historical evidence from 26 October.

## 1. What the project covers

- Three independent admin login tests: valid login, invalid login, and the dashboard.
- Eight admin navigation checks, plus Category, Brand, and Tax Structure creation and persistence.
- An admin catalog workflow that creates its own category, brand, tax structure, tax category, tax rule, option/value, shipping profile/rate, and product. It edits the product model and verifies the saved data.
- Public seller registration and business activation.
- A check of the new seller's admin approval request. Pending requests are approved only for the new test seller; already Approved requests are verified without changing them.
- A separate seller login session, shop setup, and seller shipping profile/rate.
- Seller-owned catalog product creation, followed by an admin ownership check, approval, and fulfillment setup.
- Sale and rental inventory for both the admin catalog product and the seller-owned catalog product.
- Buyer registration/login, controlled wallet credit, rental booking of both inventories, Seller fulfillment, Buyer hand-back, Seller receiving, and Admin completion with security-refund verification (section 15).

The current execution results are recorded at the end of this guide. Implemented code alone is not evidence that a test passed.

## 2. Folder structure

```text
Commercial Automation/
  playwright.config.js          Project matching, browser settings, and dependencies
  playwright.modules.config.js Independent module and related-suite matching
  playwright.rental.config.js  Isolated rental stages and integrated dependency chain
  scripts/run-tests.js          Command routing and optional shared-browser lifecycle
  scripts/run-rental.js         Rental run selection, transaction lock, shared browser
  package.json                  Existing npm commands plus test:workflow
  pages/
    LoginPage.js                Existing admin login page object
    SellerLoginPage.js          Public seller login page object
  helpers/
    workflow-data.js            Private handoff files and safe record summaries
    catalog-ui.js               Catalog dropdowns, options, and save navigation
    shipping-ui.js              Shipping profile and rate UI steps
    inventory-ui.js             Repeated sale/rental UI steps and saved-value checks
    localized-name.js           Required data-language and English name entry
    rental-data.js              Per-run private handoff, identities, and pending intents
    rental-booking-ui.js        Product/calendar/cart/checkout and paid-order checks
    rental-orders-ui.js         Exact suborder fulfillment, returns, and completion
  tests/
    auth.setup.js               Existing admin authentication setup
    seller.auth.setup.js        Independent seller authentication setup
    admin/                     Login, navigation, configuration, catalog, approvals
    seller/                    Registration, shop/shipping, product, inventory
    buyer/README.md             Earlier Buyer coverage placeholder
    rental/                     Buyer registration/login, credit, booking, fulfillment,
                                rental hand-back, receiving, and Admin completion
    modules/                   Independent Shipping/Commission and related tax suite
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

## 14. Three execution modes — added 27 October 2026

Use these commands from the project folder. The existing 23-test workflow and its dependencies remain unchanged. The three login tests remain independent. New module tests are selected by a separate configuration, so they do not increase or duplicate the workflow's 23 tests.

### Mode 1: Test one module

| Command | Scope, including required setup |
| --- | --- |
| `npm run test:brand` | Admin login setup + the existing Brand creation/persistence test: 2 checks. |
| `npm run test:category` | Admin login setup + the two existing Category tests: 3 checks. |
| `npm run test:tax-structure` | Admin login setup + the two existing Tax Structure tests: 3 checks. |
| `npm run test:shipping` | Admin login setup + Shipping Profile/rate creation and reload verification: 2 checks. |
| `npm run test:commission` | Admin login setup + read-only inspection/reload of Sale and Rent default commission fees: 2 checks. |
| `npm run test:seller-registration` | Public registration and business details only: 1 check; no admin setup or catalog dependency. |
| `npm run test:modules` | The five admin modules above together: 8 checks including one admin setup. |

Examples with optional Playwright flags:

```powershell
npm run test:brand -- --headed
npm run test:category -- --list
npm run test:module -- shipping --headed
npm run test:module -- seller-registration
```

The module configuration uses only an admin authentication dependency for admin modules. Each creation test builds its own required data. Public registration starts unauthenticated. Module registration writes private account metadata under `.auth/modules/`; it does not overwrite `.auth/seller-account.json` or either workflow role state. A module registration does not create a shop, run approval checks, or populate inventory.

Commission coverage is deliberately read-only. The observed default dialogs have type, fee, and ID fields and do not have category/seller/product targeting fields. The test reads both fee types, validates numeric percentage values, closes without saving, reloads, and compares the persisted values. It does not test commission editing, category/seller overrides, order calculations, or payment totals. No default commission value is changed.

### Mode 2: Test related modules together

```powershell
npm run test:tax-suite
npm run test:tax-suite -- --headed
npm run test:suite -- tax
```

This runs admin authentication followed by three ordered tests: create a Tax Structure, create a Tax Category, and create a five-percent Rest Of The World rule that links the new category and structure. The suite reloads the UI to verify persistence. It creates no product, brand, seller, or shipping prerequisite. All three records are retained. If an earlier serial test fails, dependent tests in this related suite are skipped; the partial records are still attached to the report.

Only this related tax suite is currently provided. Combined Tax and standalone Tax Category/Tax Rule commands are not claimed as implemented.

### Mode 3: Run the complete workflow

```powershell
npm run test:workflow
npm run test:workflow:headed
npm run test:workflow:sequential
```

`test:workflow` is the original command with its existing project behavior. `test:workflow:headed` runs the same 23 tests in order with one worker and one owned Chromium browser launch. `test:workflow:sequential` uses the same browser reuse in headless mode.

The headed shared-browser variant was executed end to end in this verification. The headless shared-browser alias uses the same launcher with headless enabled, but was not separately executed; do not count it as another passing test run.

The launcher starts a local Playwright browser server and passes its private WebSocket endpoint to the child test process through an environment variable. `connectOptions` tells Playwright's normal browser/context/page fixtures to connect to that browser. The launcher closes the browser server when tests finish or a handled interruption stops the child process. No server is started for `--list`.

This reuses the browser process, not a context or page. Every test still receives a fresh context; admin projects load admin state, seller projects load seller state, and registration/setup contexts start unauthenticated. Windows/tabs may still close or change between contexts and workers. It is not a promise of one continuous page or zero visual transitions. No slow motion, fixed sleeps, context-reuse switch, or single long replacement test was added.

One worker makes independent admin smoke tests sequential; the existing project dependencies still establish the Admin-to-Seller stage order. Worker/shard/parallel overrides are rejected by the sequential launcher. The original command is available when the normal parallel admin execution is preferred. Do not run two complete workflows concurrently because they deliberately share the latest workflow handoff files.

The standard feature assertions, existing authentication setup, and existing workflow test files were not rewritten. The main config has only an opt-in `connectOptions` addition. Module data scoping is the only helper change. The new runner invokes the existing local Playwright CLI through Node, without a shell command string or dependency download.

See [Playwright's supported connectOptions setting](https://playwright.dev/docs/api/class-testoptions#test-options-connect-options).

### Verification on 27 October 2026

| Exact command/check | Actual result |
| --- | --- |
| `npm run test:brand -- --list` | Exactly Brand + admin setup discovered; 2 checks, no unrelated workflow. |
| `npm run test:modules` | 7 passed, 1 failed. The new Commission test incorrectly expected New-form targeting inputs in the default dialog. No settings were saved. |
| `npm run test:commission` | 2 passed after asserting the actual default form shape. Fee reload comparison passed; no Save action. |
| `npm run test:tax-suite` | 4 passed: setup + all three related tax tests. |
| `npm run test:seller-registration` | 1 passed independently. |
| Workflow-file isolation check after module registration | Passed: workflow account/catalog handoffs and both role state files retained their original size and modification time. Module account archive exists under `.auth/modules/`. |
| `npm run test:workflow` | 19 passed, 1 failed, 3 did not run. The existing seller-product navigation to `/seller/custom-product-form` did not reach DOM content within its unchanged 120-second test budget, before any product fields were entered. |
| Read-only navigation diagnostic using current seller state | HTTP 200 and product form visible. The navigation stall was not reproduced; its root cause is unconfirmed. |
| `& .\node_modules\.bin\playwright.cmd test --project=chromium-seller-product --no-deps` | 1 passed unchanged on the focused rerun. The new product was retained Un-approved; the later workflow stages were not run for this partial dataset. |
| `npm run test:workflow:headed` | **23 passed (2.9 minutes), 0 failed, 0 skipped.** Output confirmed 1 worker, the shared browser launch, and browser-server closure at completion. |

No existing workflow assertion, navigation timeout, or retry policy was changed to hide the intermittent navigation failure. JavaScript syntax checks passed for the configs, runner, helpers, page objects, and tests.

Retained module data includes Brand `QA Brand b7db530d` **120**, Category `QA Category ffa49060` **110**, Tax Structure `QA-0cc498a9cb9a` **92**, Shipping Profile `QA Ship 40e394f5` **77** with Zone **82** and Rate **88**, tax suite Structure `QA Tax 01f58134` **93**, Category `QA Class 01f58134` **58**, and Rule `QA Rule 01f58134` **21**. Independent registration retained `QA Seller e32d2b9d`; the module deliberately does not run admin account lookup to obtain its ID.

The standard workflow attempt retained admin product `Cordless Drill 73207e8a` **256**, seller `QA Seller fe711ddf` **257**, shop **59**, seller shipping profile **80**, and the focused rerun's seller-owned product `QA Seller Drill fe711ddf` **257**. Full prerequisite IDs are retained in `.auth/admin-workflow-73207e8a.json`; private account metadata is archived separately without being printed.

The passing headed run retained standalone Brand `QA Brand 56c4a0a3` **123**, Category `QA Category ac3abb82` **113**, and Tax Structure `QA-45b86cf9e946` **97**. Its complete catalog group, suffix `29a6dffb`, contains Category **114**, Brand **124**, Tax Structure **96**, Tax Category **60**, Tax Rule **23**, Option **24**, Shipping Profile **81**, Zone **86**, Rate **92**, and admin product `Cordless Drill 29a6dffb` **258**. Seller `QA Seller 2756e751` **258**, Shop **60**, seller Shipping Profile **83** / Zone **88** / Rate **94**, seller product `QA Seller Drill 2756e751` **259**, and sale/rental inventory IDs **311** and **312** were also retained and verified.

All records from these runs are retained. The historical Tax Category 51 deletion defect remains unresolved and was not retried. Default commission was never submitted or changed. No new dependencies were installed.

Files changed for these modes: `playwright.config.js`, `package.json`, `helpers/workflow-data.js`, and this guide. Files added: `playwright.modules.config.js`, `scripts/run-tests.js`, `tests/modules/shipping.spec.js`, `tests/modules/commission.spec.js`, and `tests/modules/tax-suite.spec.js`. Existing workflow specs and both authentication setup files were left unchanged.

## 15. Buyer rental smoke workflow (27 October 2026)

Latest integrated verification: `npm run test:rental:headed`, run `dba1cc0a`, **36 passed, 0 failed, 0 skipped, 0 did not run (5.7 minutes)**. This includes all 23 original Admin/Seller tests and all 13 new rental tests in one uninterrupted run. Both rental suborders are Completed and the Buyer received both security refunds. Earlier failed development attempts and their confirmed fixes are recorded below; they are not hidden or counted as passes.

The original `playwright.config.js`, 23-test dependency chain, module configuration, login tests, and module commands remain separate. The new `playwright.rental.config.js` selects only the requested rental stage and its role authentication. Full mode includes the original 23 tests followed by 13 rental tests (36 total, including authentication). All three roles have separate contexts. `scripts/run-rental.js` keeps one Chromium process open and uses one worker with zero retries; each test still gets a fresh isolated context. `--headed` keeps this easier to watch without sharing role sessions or combining the journey into one long test.

### Commands in simple English

| Command | What it does | Required saved data |
| --- | --- | --- |
| `npm run test:buyer:registration` | Creates one new Buyer and verifies its profile ID and identity. Starts a new run. | Only configured client URL; no Seller workflow required |
| `npm run test:buyer:auth` | Logs in as that exact Buyer and saves fresh Buyer state. | Successful Buyer registration |
| `npm run test:buyer:credit` | Runs Admin authentication, credits that Buyer $500 once, and verifies the saved ledger entry. | Registered Buyer with an empty wallet history, or this run's verified credit |
| `npm run test:buyer:booking` | Runs Buyer authentication, finds both rental inventories, selects dates, creates an address, checks prices, and pays from the wallet. | Verified credit and both completed original-workflow inventories |
| `npm run test:seller:fulfillment` | Logs in as the order's Seller and handles each exact suborder through In Process, Shipped, Delivered. | Verified paid order and retained Seller account |
| `npm run test:buyer:return` | Logs in as Buyer and records rental hand-back for both exact delivered suborders. | Both lines Delivered |
| `npm run test:seller:return` | Logs in as Seller, receives the same scan-coded items, and recommends full security refund. | Buyer hand-back saved |
| `npm run test:admin:complete` | Runs Admin authentication, verifies Buyer/Seller ownership, completes each returned suborder, and verifies persistence. | Seller receiving saved |
| `npm run test:rental:workflow` | Creates fresh Admin/Seller prerequisites, then runs the entire rental journey sequentially. | Admin credentials and supported client UI/settings |
| `npm run test:rental:headed` | Same full rental workflow with a visible browser. | Same as above |

Run the stage commands in table order for a new Buyer using already-created inventory. If inventory is missing, run the existing `npm run test:workflow:sequential` first. Standalone commands never silently run unrelated catalog, shop, registration, or order workflows. A standalone fulfillment/return command performs only its role login and the requested two suborder tests. Admin stages perform only Admin login and their own operation.

Add `-- --headed` to any stage command. Add `-- --run be8921f5` to select a specific retained run, instead of the local current-run pointer. For example: `npm run test:buyer:booking -- --run be8921f5` verifies that run's already-paid order without creating a new order. `npm run test:rental:workflow -- --list` lists all 36 tests without opening a browser or creating application records. Do not use repeated-test/retry, parallel worker, UI/debug, or dependency-bypass options for transaction tests; the runner rejects these overrides. Run one business workflow at a time, including the original Admin/Seller commands, because original handoff files are shared.

### Data handoff and transaction safety

Private account credentials and browser state live only under ignored `.auth/`. Each rental run has `.auth/rental/runs/<run-ID>/buyer-account.json`, `buyer.json`, `seller-account.json`, `seller.json`, and `journey.json`. `.auth/rental/current.json` selects the local current run; it does not select the application's latest order. The journey records exact Buyer, Seller, inventory, address, parent order, suborder IDs, amounts, scan codes, and status references. Booking snapshots its source Seller account and inventory, so a later original-workflow run cannot make fulfillment log in as a different Seller. The original root handoff files and authentication states keep their existing purpose.

The runner takes an exclusive local rental lock. Each wallet credit, cart addition, checkout, payment, and status mutation records an intent before clicking Submit. Saved verified credits/orders are checked again without resubmitting. Saved statuses are checked on the exact suborder and cannot be regressed. An uncertain credit/payment/checkout stops with a reconciliation message; there are no blind transaction retries. A confirmed saved status can reconcile its own pending transition. Do not remove a pending intent merely to make a run pass. Inspect its exact Buyer, reference, order, and ledger in UI first. After an interrupted command, check no rental process is running before manually removing a leftover `.auth/rental/execution.lock`.

All created application records are retained. No cart clear, record deletion, or global setting update is part of this extension. Starting registration/full again intentionally creates a different unique run; use `--run` for an existing journey. Normal stage reruns verify prior completed results; they do not create new wallet credits or orders.

### Verified UI behavior and scope

The public site can initially display Arabic. Rental tests use the observed `/en/` routes; this changes only their navigation language, not the site's global language. Buyer email verification was not required. Buyer login verifies profile name, ID, and private username/email equality. The normal rental return uses the suborder's Order Status form, not the separate Refunds/damaged-product request form.

This controlled smoke uses one unit of each existing original-workflow inventory, three inclusive rental days starting seven days in the future, $15/day, $25 security per item, 5% rental tax, and two $9.50 delivery fees. The expected wallet payment is $163.50: $90 rent + $50 security + $4.50 tax + $19 delivery. A changed price/currency/rate causes a failure rather than silently changing data or settings. Test shipping/return tracking links use reserved `example.com` and do not contact a real carrier. The saved US test address and reserved phone are synthetic UAT data.

The two inventory lines create one parent order and two rental suborders. Each suborder follows Payment Confirmed -> In Process -> Shipped -> Delivered -> Ready for Rental Return - Buyer -> Rental Returned -> Completed. Shipping binds the exact inventory scan code. Seller receiving recommends a full $25 security refund per line; Admin completion uses the locked received scan code and the recommended full refund. The UI accepts these UAT transitions before the future rental dates. This verifies functional status handling, not elapsed rental time, real delivery, carrier integration, damage/refund disputes, late fees, partial returns, extension, cancellation, other gateways/currencies, or real email delivery. Normal rental hand-back has a tracking reference and suborder ID; it does not create the separate Refunds request ID.

Raw rental traces and automatic screenshots are disabled because they can contain credentials, cookies, and private account data. The runner also disables Playwright's automatic page-copy snapshots for this command. Rental failures attach a screenshot masking input fields and known Buyer/Seller private values, plus a whitelisted JSON summary containing business IDs, amounts, and pending stage. The existing original suite retains its previous artifact behavior. Treat all local reports as private; never upload `.env`, `.auth/`, raw browser states, or account credentials.

### Validation results

Results and retained business IDs are recorded below after command execution. Earlier sections describe historical runs and must not be treated as results for the new rental extension.

The first full headed attempt (`dca6f0ea`) finished with **12 passed, 3 failed, 21 did not run, 0 skipped**. Its original Admin/Seller portion had 12 passed, 3 failed, and 8 blocked by dependencies; the 13 new rental tests were also blocked. The failures were existing Category creation, the catalog workflow's Category step, and Tax Structure creation. Actual form inspection showed required data language `2`, while those tests filled only `[1]`; Tax's English translation was collapsed. `helpers/localized-name.js` now fills the actual required name and the existing English translation using observed accordion controls. The same verified change applies to Shipping Profile and the tax suite. No global language setting or assertion was changed. Focused follow-ups: `npm run test:category` **3 passed**, `npm run test:tax-structure` **3 passed**, `npm run test:shipping` **2 passed** (all 0 failed, 0 skipped).

Focused rental validation before that full attempt:

| Exact command | Confirmed final result |
| --- | --- |
| `npm run test:buyer:auth -- --run be8921f5` | 1 passed |
| `npm run test:buyer:booking -- --run be8921f5` | 2 passed, including authentication; verifies saved paid order, no new payment |
| `npm run test:seller:fulfillment -- --run be8921f5` | 3 passed after scoping the Seller's customer-name locator |
| `npm run test:buyer:return -- --run be8921f5` | 3 passed |
| `npm run test:seller:return -- --run be8921f5` | 3 passed |
| `npm run test:admin:complete -- --run be8921f5` | 3 passed; rerun also verified both saved security refund entries and $386.50 balance |
| `npm run test:buyer:registration` | 1 passed; created run e016adc1, Buyer 260 |
| `npm run test:buyer:credit -- --run e016adc1` | 2 passed; one $500 credit, TN-0000451 |
| `npm run test:buyer:booking -- --run e016adc1` | Final saved-payment reconciliation: 2 passed; exactly one wallet payment |
| `npm run test:rental:workflow -- --list` | 36 tests discovered, no application records created |

All successful focused runs above had 0 failed and 0 skipped. Initial rental failures are retained in this account of the work: fulfillment first reported 1 passed/2 failed because the Buyer name appeared twice on Seller pages. Four development booking attempts each reported 1 passed/1 failed: a calendar redraw race, nested `main` locators, checkout page-render timing during saved-address continuation, and receipt text that includes the order ID. They were corrected through observed UI locators/conditions. Checkout was reconciled read-only before continuation; the payment was never resubmitted. The final payment reconciliation requires the exact order to be Paid with its wallet transaction and expected balance; otherwise it remains blocked.

Retained focused records:

| Run | Buyer | Seller | Catalog products | Inventories | Parent order | Rental suborders | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| be8921f5 | 259 | 258 | 258, 259 | 311, 312 | O1793109907 | 614 / S0001, 615 / S0002 | Both Completed; both $25 security refunds verified |
| e016adc1 | 260 | 258 | 258, 259 | 311, 312 | O1793111510 | 618 / S0001, 619 / S0002 | Paid; retained for independent fulfillment/return practice |

Prototype return tracking references are `QARbe8921f5A` and `QARbe8921f5S`. This is normal rental hand-back, so there is no separate refund-request ID. Synthetic address IDs are 112 and 113. The focused second order intentionally remains Paid; it is not deleted or silently fulfilled.

A second full attempt (`b896c869`) finished with **14 passed, 1 failed, 21 did not run, 0 skipped**. The catalog workflow reached Option creation, where the UI required `option_name2` while the old code filled only `option_name1`. The Option Value form likewise required `optionvalue_name2`. Both now use the same localized-name helper. `npm run test:authenticated -- tests/admin/product-creation.spec.js` then passed **2/2**, including Admin setup, with all original catalog assertions intact.

The same targeted UI inspection confirmed rental inventory requires `selprod_title2`, with English `selprod_title1` behind the `Inventory Data For English` accordion. Inventory creation now fills both through that actual button. Seller registration on unprefixed `/supplier` was observed to have `html lang=ar` and no English Login link. Existing Seller navigation/login now uses `/en/` routes, updates its exact URL expectations accordingly, and normalizes the optional prefix only when matching observed save responses. The shared public login page object is reused by new Buyer/Seller authentication. These are input/locale fixes for confirmed current UI behavior; the 23 original tests, their data/assertions, role separation, and dependency chain remain intact. No site-default language control was clicked.

The third full attempt (`371c2ef7`) reached **21 passed, 2 failed, 13 did not run, 0 skipped**. Both inventory tests stopped before mutation because the new localized-name helper inspected the AJAX form before its inputs arrived. The helper now waits for the form and name fields. Focused command `node node_modules/@playwright/test/cli.js test tests/seller/inventory.spec.js --project=chromium-seller --no-deps --workers=1` then passed **2/2**, using the exact approved Seller/products/authentication that had just passed. Inventories 313 and 314 remain attached to Seller 261 and products 261/262. This dependency bypass was used only for that explicit focused verification of already-passed prerequisites; normal rental npm commands reject `--no-deps`.

All original 23 scenarios had passed their latest checks at this point (21 in the preceding full attempt plus the two focused inventory checks). A subsequent full run is still needed as evidence of one uninterrupted integrated 36-test pass. The language helper supplies the same unique QA label in the required language and English; it does not test translation accuracy or change the required/default language. Fresh isolated contexts can still open/close visible windows; sharing the Chromium process removes browser process restarts without sharing role cookies.

The fourth full attempt (`d7fa6a1f`) finished with **21 passed, 2 failed, 13 did not run, 0 skipped**. Both inventories were saved (315 and 316) but the verification dialog's Continue action ran before Bootstrap finished opening it. The barcode dialog was confirmed to use Bootstrap 5.1.3. `helpers/inventory-ui.js` now registers a `shown.bs.modal` observer before opening that dialog and waits for the actual event before interaction; it does not sleep, force-click, or retry Save. Focused headed command `node node_modules/@playwright/test/cli.js test tests/seller/inventory.spec.js --project=chromium-seller --no-deps --workers=1 --headed` passed **2/2** against the retained records without creating replacements.

Files added for this extension: `playwright.rental.config.js`, `scripts/run-rental.js`, `helpers/localized-name.js`, `helpers/rental-data.js`, `helpers/rental-booking-ui.js`, `helpers/rental-orders-ui.js`, and `tests/rental/{fixture,registration,buyer-auth,credit,booking,seller-auth,fulfillment,buyer-return,seller-return,complete}.js` (test files use `.spec.js` except fixture). Files modified: `package.json`, this guide, `pages/SellerLoginPage.js`, `tests/seller.auth.setup.js`, `tests/admin/{categories,tax-structure,product-creation}.spec.js`, `tests/seller/{registration,shop,product}.spec.js`, `helpers/{shipping-ui,inventory-ui}.js`, and the existing `tests/modules/tax-suite.spec.js`. The original main/module configuration, Admin authentication setup, login tests, credentials, Git ignores, dependencies, and unrelated working-tree changes were preserved.

The fifth full attempt (`b30af30e`) finished with **14 passed, 1 failed, 21 did not run, 0 skipped**. The catalog workflow stopped after reloading Shipping Profile 92: the zone table's POST read was still pending when the five-second DOM assertion ended the test. Read-only UI inspection confirmed rate 103 was saved correctly with the expected $12.50 and two-day duration. Shipping reload now waits for the observed `/shipping-zones/search/<profile-ID>` response to finish before checking the rendered saved row. `npm run test:shipping -- --headed` then passed **2/2**. No retry, assertion relaxation, global timeout increase, duplicate wallet credit, or duplicate order was involved. Booking also validates that the retained inventory's catalog product ID matches the original handoff, so mismatched prerequisite files fail clearly.

The sixth full attempt (`1e7641c3`) passed **all 23 original Admin/Seller tests**, then Buyer registration, authentication, and credit. It finished **26 passed, 1 failed, 9 did not run, 0 skipped** because the new inventory was absent from the first 12 search results. Read-only inspection confirmed both products are publicly available. The observed search returns a broader result set than its keyword and does not reliably put the requested product on the first page. Selecting its real local `48 Items` control exposes both exact records; this changes only the search view, not global settings. Booking now waits for the search read response, requires its exact inventory title and ID, and verifies the exact shop URL. If the target cannot be found within that supported view, the test fails before adding it; strict keyword filtering/search relevance and catalogs needing more than 48 visible results are not claimed as covered.

New shops can show their saved identifier as an English display-name fallback. Product verification accepts only the known shop name or identifier at its exact verified slug. Saved order details display `Sold By` as plain text, so the order assertion checks that exact saved value; Admin later verifies numeric Buyer/Seller ownership IDs. No imaginary order-page shop link is assumed.

Focused follow-up `npm run test:buyer:booking -- --run 1e7641c3 --headed` first reached one successful payment but reported 1 passed/1 failed at that invented shop-link assertion. After inspecting the actual plain-text order UI and correcting the selector, the same command reconciled the saved payment read-only and passed **2/2**, with no second Pay click. Buyer 264, Seller 263, products 265/266, inventories 317/318, parent order O1793113751, suborders 622/623, credit TN-0000453, and wallet payment W-1793113756 are retained. `npm run test:seller:fulfillment -- --run 1e7641c3 --headed` then passed **3/3** and both lines are Delivered; that order is retained for independent return practice.

### Final integrated result and retained records

`npm run test:rental:headed` completed run `dba1cc0a`: **36 passed, 0 failed, 0 skipped, 0 did not run (5.7 minutes)**. All 23 original Admin/Seller scenarios and all 13 rental scenarios passed together. Admin and Buyer assertions verified both Completed suborders, two completed $25 security refunds, and the final $386.50 wallet balance. Earlier failures above were corrected through actual UI/response inspection; assertions were not weakened and no global timeout or retry setting was increased.

| Retained record | ID / value |
| --- | --- |
| Buyer | 266, QA Buyer dba1cc0a |
| Seller / shop | Seller 265, QA Seller f02bfe84 / Shop 64, QA Shop f02bfe84 |
| Admin-created / Seller-created catalog products | 267 / 268 |
| Rental inventories | 319 / 320 |
| Saved test address | 115 |
| Wallet credit / payment | TN-0000455 / W-1793114214 |
| Parent order | O1793114209 |
| Suborders | 626, O1793114209-S0001 / 627, O1793114209-S0002 |
| Rental dates and quantity | 2026-11-03 to 2026-11-05 inclusive; one of each item |
| Payment | $163.50; one wallet payment |
| Normal rental return references | QARdba1cc0aA / QARdba1cc0aS; tied to suborders 626 / 627, no separate Refunds request ID |
| Final status / balance | Both Completed / $386.50 after $50 security refunded |

Post-completion replay checks preserve the full HTML report by using the list reporter and separate output folders:

- `npm run test:buyer:credit -- --run dba1cc0a --reporter=list --output=test-results/rental-credit-replay`: **2 passed, 0 failed, 0 skipped**. The same unique completed TN-0000455 entry was verified; no Add new/Save credit operation was submitted.
- `npm run test:buyer:booking -- --run dba1cc0a --reporter=list --output=test-results/rental-booking-replay`: **2 passed, 0 failed, 0 skipped**. The same O1793114209 / W-1793114214 and completed suborder identities were verified; no cart addition, checkout, order creation, or Pay operation was submitted.

Open the retained full HTML report with `npm run report`. Syntax checks cover all added/modified JavaScript, and `git diff --check` is used for whitespace validation. `.env` and `.auth/` remain ignored. All created records, including partial earlier catalog records and the two practice orders, remain in the application. The separate discovery browser and its temporary endpoint file were closed/removed. No dependency was installed.

Final changed-suite check: `npm run test:tax-suite -- --reporter=list --output=test-results/tax-suite-regression` passed **4/4**, with 0 failed and 0 skipped. This verifies the preserved related Tax Structure + Tax Category + Tax Rule command after its localized-name input change. Its retained IDs are structure 112, tax category 68, and rule 31. The full rental HTML report remains available.

All **27 added/modified JavaScript files passed `node --check`**. `git diff --check` passed; Git emitted only line-ending normalization notices. `git check-ignore .env .auth/rental/current.json` confirmed both private locations remain ignored. The rental lock is absent after command completion, and `playwright-report/index.html` exists. Failure screenshots additionally mask mail links and Admin listing tables so failures before filtering cannot reveal unrelated accounts.

Earlier prerequisite verification also retained catalog product 260 from the focused catalog check; products 261/262 and inventories 313/314 for Seller 261; and products 263/264 and inventories 315/316 for Seller 262. Their records were not deleted. The latest complete run's products 267/268 and inventories 319/320 are the records used by completed order O1793114209. Practice order O1793113751 uses products 265/266 and inventories 317/318; practice order O1793111510 uses the earlier source products 258/259 and inventories 311/312. Existing module commands remain separate from rental execution.

## 16. Team smoke checklist: normal rental, cancellation, and refund

The shareable [Smoke Checklist](SMOKE_CHECKLIST.md) is the business smoke map.
`tests/smoke-checklist/` contains only the additional branch specs and its README.
`playwright.smoke.config.js` composes the original 36 tests in their existing
folders, followed by 12 cancellation checks and 12 refund checks: 60 total.
Existing main, module, related-suite, Buyer, and rental npm commands remain available.

Run these commands from the project folder:

```powershell
npm run test:smoke:headed
npm run test:smoke
npm run test:smoke:cancel -- --source-run <completed-rental-run-ID>
npm run test:smoke:refund -- --source-run <completed-rental-run-ID>
npm run report:smoke
```

The first command shows the complete journey. The second runs it without visible
browser windows. The next two run only one lifecycle branch plus required Admin
authentication and branch preparation (13 tests each). They reuse the exact
approved inventory and Seller account from a completed original rental run;
they do not run unrelated catalog/shop modules. Omit `--source-run` only when the
local `.auth/rental/current.json` is the intended completed normal run. If no
completed source exists, run `npm run test:rental:workflow` first. Full smoke
creates its own prerequisites and does not require that pointer.

Each invocation normally creates fresh records. To verify/resume an existing
branch, use the **smoke run ID printed by the runner**, for example:

```powershell
npm run test:smoke:cancel -- --run <smoke-run-ID>
npm run test:smoke:refund -- --run <smoke-run-ID>
```

The private manifest pins the source and two distinct branch IDs. Each branch
creates a separate Buyer and paid parent order, with an Admin-inventory line and
a Seller-inventory line. Buyer registration and wallet-credit logic are shared
with the original specs; project metadata scopes their handoff files per branch.
Completed requests are checked against exact ledger transactions on replay,
without submitting approvals again. Uncertain submissions stop with a recorded
intent and require exact-record reconciliation; never delete guards to bypass it.
The shared execution lock prevents overlapping rental/smoke transaction commands.

Full execution uses one worker, zero retries, and one Chromium process. Admin,
Seller, and Buyer keep separate isolated authentication contexts. Context windows
and tabs may still close/open; this is not a single shared-cookie session or a
single long test. Financial pages use whitelisted business diagnostics rather
than raw traces or screenshots. Reports remain internal QA material.

Cancellation is Buyer request, Seller **view only**, then Admin approval. The
application's displayed refund excluding security and its security amount are
checked against separate completed credits in the same Buyer's wallet. Refund
is a distinct paid order delivered by Seller, followed by the Buyer's direct
**Refunds** action and Seller **Approve Refund**. It does not submit the normal
rental hand-back or require Admin approval. The saved reason, quantity, product,
request ID, role ownership, status, quote, and balances are asserted.

Existing targeted examples remain unchanged:

```powershell
npm run test:brand
npm run test:category
npm run test:tax-structure
npm run test:shipping
npm run test:commission
npm run test:seller-registration
npm run test:tax-suite
npm run test:rental:workflow
```

Use `npm run test:smoke -- --list` for non-mutating discovery. See the checklist
for current execution evidence, retained IDs, coverage boundaries, and known
application issues. No application records are deleted, no global settings are
changed, and no dependencies are installed by this extension.

Smoke extension files:

- New entry points: `playwright.smoke.config.js`, `scripts/run-smoke.js`, and
  `tests/smoke-checklist/` (nine branch spec files plus README).
- New shared helpers: `buyer-account-ui.js`, `smoke-branch-data.js`,
  `lifecycle-ui.js`, `cancellation-ui.js`, `refund-ui.js`, `modal-ui.js`, and
  `public-routes.js` under `helpers/`.
- Reused rental files updated: `helpers/rental-data.js`,
  `helpers/rental-booking-ui.js`, `helpers/rental-orders-ui.js`,
  `tests/rental/fixture.js`, `tests/rental/registration.spec.js`, and
  `tests/rental/credit.spec.js`. Registration/credit bodies are shared rather
  than duplicated; existing titles, functional assertions, and commands remain.
- Confirmed shared UI fixes: `pages/LoginPage.js` gives a sanitized database
  failure diagnostic and private credential filling; `tests/seller.auth.setup.js`,
  `helpers/shipping-ui.js`, and `helpers/inventory-ui.js` accept observed canonical
  English routes while preserving role/path/ID assertions. The rental booking
  helper waits for the actual price-modal transition before dismissal.
- Supporting updates: five new npm scripts in `package.json`, `smoke-report/`
  in `.gitignore`, this guide, and `docs/SMOKE_CHECKLIST.md`.

This list describes the smoke extension only. Earlier uncommitted module/rental
work remains in the workspace and is not reverted or attributed to this change.

### Smoke validation on 28 October 2026

| Exact command | Actual result |
| --- | --- |
| `npm run test:smoke:cancel -- --run 39d6bf8e --headed` | 13 passed; existing approved requests/unique credits reconciled without another approval |
| `npm run test:smoke:refund -- --run 39d6bf8e --headed` | 13 passed; existing Seller refunds/unique credits reconciled without another approval |
| `npm run test:smoke:refund -- --run cc315e24 --headed` | 13 passed, 2.5 minutes; completed the prepared branch after the modal fix |
| `npm run test:rental:workflow` | 36 passed, 5.8 minutes; run `022826cf` |
| `npm run test:brand -- --reporter=list --output=test-results/backward-brand` | 2 passed, including setup |
| `npm run test:commission -- --reporter=list --output=test-results/backward-commission` | 2 passed, including setup; read-only fees |
| `npm run test:login -- --reporter=list --output=test-results/backward-login` | 3 passed, unauthenticated project only |
| `npm run test:smoke:headed` | **60 passed, 10.4 minutes**; run `c12acd79` |
| `npm run test:smoke -- --list` | 60 discovered; not counted as executed tests |

All successful execution rows above had **0 failed, 0 skipped, 0 did not run**.
The first full smoke attempt (`cc315e24`) had 51 passed, 1 failed, 8 did not run:
the refund price-modal Close action raced its opening animation before checkout.
That confirmed UI synchronization issue was corrected; its saved cart was
reconciled before resuming. Earlier UAT database errors were also reconciled
against exact request/wallet records after service restoration. No uncertain
approval was resubmitted. One initial sandboxed rental launch returned `spawn
EPERM` before tests started; its authorized browser-access rerun produced the
36-pass result above. The final full smoke run was headed; a separate full
headless smoke execution was not repeated.

Latest complete smoke evidence:

| Flow | Buyer / Seller | Parent order / suborders | Requests / outcome | Wallet after payment -> after refunds |
| --- | --- | --- | --- | --- |
| Normal rental | 278 / 277 | O1793182880 / 658, 659 | Both Completed; normal hand-back | $336.50 -> $386.50 |
| Cancellation | 279 / 277 | O1793183051 / 662, 663 | Cancellation 20/21; Admin Approved, orders Cancelled | $336.50 -> $417.31 -> $498.12 |
| Direct refund | 280 / 277 | O1793183175 / 666, 667 | Refund 25/26; Refunded by Seller | $336.50 -> $418.25 -> $500.00 |

Each distinct parent was paid $163.50; source products 275/276 and inventories
327/328 are retained. Cancellation returned the application's $55.81 quote plus
$25 security per line ($161.62 total), via unique TN-0000531/532 and
TN-0000534/535 entries. Seller refunds returned the application's $81.75 per line
($163.50 total), via TN-0000539 and TN-0000540. The quote components, exact ledger
rows, status, balances, and ownership were verified, not merely form submission.
The [checklist](SMOKE_CHECKLIST.md) also records prior branch/order IDs and
payment references. All final branch guards are clear after reconciliation.

Syntax checks passed for all 62 JavaScript files, and `git diff --check` passed
with only line-ending notices. `.env`, `.auth/`, and `smoke-report/` remain ignored.
Both HTML reports exist; the execution lock and temporary inspection endpoint
are absent. All records remain. No dependency was installed.

Coverage limits: full-quantity USD wallet fixtures, the observed cancellation
policy, direct Seller-approved refunds, and the existing normal rental return.
Partial/disputed/damaged refunds, alternate deductions/policies, external payment
gateways, translation accuracy, email delivery, and load/performance are not
claimed. Search uses the observed local 48-item view and exact inventory IDs;
targets outside that view fail safely. Refund pages showed PHP `strlen(null)`
deprecation notices, which remain an application issue. Existing independent
Commission/Shipping modules and related tax suite are not silently added to the
full checklist. Global settings were not changed.
