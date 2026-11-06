const { expect } = require('@playwright/test');

// Admin data language can differ from the English interface language. Fill
// the actual required field as well as the existing English test translation.
// This changes only the new record, never the site's language settings.
async function fillLocalizedName(form, field, value, englishHeading = 'English Language Data') {
  await expect(form).toBeVisible();
  const fields = form.locator(`input[name^="${field}"]`);
  await expect(fields).not.toHaveCount(0);
  const names = await fields.evaluateAll(inputs => inputs
    .filter(input => JSON.parse(input.getAttribute('data-fatreq') || '{}').required)
    .map(input => input.name));
  expect(names.length, `Expected a required ${field} input in the actual form`).toBeGreaterThan(0);
  for (const name of names) await form.locator(`input[name="${name}"]`).fill(value);
  const bracketed = form.locator(`input[name="${field}[1]"]`);
  const english = await bracketed.count() ? bracketed : form.locator(`input[name="${field}1"]`);
  if (!await english.isVisible()) {
    const englishSection = form.getByRole('button', { name: englishHeading, exact: true });
    if (await englishSection.count()) await englishSection.click();
    else await form.getByRole('button', { name: 'Language Data', exact: true }).click();
  }
  await english.fill(value);
}
module.exports = { fillLocalizedName };
