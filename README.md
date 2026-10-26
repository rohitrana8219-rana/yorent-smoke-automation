# Commercial Automation

JavaScript/CommonJS UI automation for YoRent using Playwright Test and Chromium.

See [the project guide](docs/PROJECT_GUIDE.md) for the role folders, authentication, workflow dependencies, presentation walkthrough, execution evidence, retained demo data, and known defects.

```powershell
npm run test:login
npm run test:authenticated
npm run test:workflow
npm run report
```

Keep private configuration in the ignored `.env`. Each workflow run retains its demo records, including partial data after failures. The known Tax Category 51 deletion issue remains unresolved.
