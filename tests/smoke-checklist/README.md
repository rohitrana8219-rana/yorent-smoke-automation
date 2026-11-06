# Smoke checklist entry point

Run `npm run test:smoke:headed` from the project root to watch the full checklist,
or `npm run test:smoke` for headless execution. Both compose 60 tests through
`playwright.smoke.config.js` without moving or copying the original module specs.

Use `npm run test:smoke:cancel` or `npm run test:smoke:refund` for one branch.
Each needs an explicit completed normal rental handoff; see the source and rerun
commands in the [team checklist](../../docs/SMOKE_CHECKLIST.md).

The checklist maps every scenario to its role, spec, expected result, and command.
The [project guide](../../docs/PROJECT_GUIDE.md) records validation and limitations.
All generated application records are retained. Never share `.env`, `.auth/`,
account files, or browser state.
