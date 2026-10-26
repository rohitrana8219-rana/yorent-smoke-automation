# Application Inventory

## Verified observations

### YoRent Admin Login

- **URL:** https://test-yorent.kit.4qcteam.com/admin/admin-guest/login-form

| Visible element | Type | Observed behavior |
| --- | --- | --- |
| Username | Input | Required when signing in; a mandatory-field error appears beneath the field when missing. |
| Password | Input | Required when signing in; a mandatory-field error appears beneath the field when missing. |
| Remember me | Switch | Signing in works whether it is checked or unchecked. |
| Sign in | Button | Valid credentials navigate to the admin dashboard. Invalid credentials show: “The Following Errors Occurred: Invalid Username Or Password”. |
| Forgot password | Link | Opens a new page where the user enters an email address and selects Submit to request a password-recovery email. |

### Login prerequisites and outcome

- **Prerequisite:** Valid admin credentials.
- **Expected success outcome:** Navigation to the admin dashboard at https://test-yorent.kit.4qcteam.com/admin.

## Pending investigation

- Exact wording of the mandatory-field errors.
- Forgot-password page URL, email field label, and Submit button label.
- Confirmation shown after submitting a password-recovery request and whether email delivery was verified.
- Whether Remember me affects persistence across browser sessions or after cookies are cleared.
