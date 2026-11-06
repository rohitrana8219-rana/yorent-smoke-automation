const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { dismissCookies } = (() => {
  // The original helpers require a selected rental run even for read-only use.
  process.env.YORENT_RENTAL_RUN = process.env.YORENT_SANITY_SOURCE_RUN;
  return require('../../helpers/rental-data');
})();
const run = process.env.YORENT_SANITY_SOURCE_RUN;
const dir = path.join('.auth','rental','runs',run);
const data = JSON.parse(fs.readFileSync(path.join(dir,'journey.json')));
const seller = JSON.parse(fs.readFileSync(path.join(dir,'seller-account.json')));
const recordFile = path.join(dir,'sanity-gap-records.json');
const records = () => fs.existsSync(recordFile) ? JSON.parse(fs.readFileSync(recordFile)) : {};
const persist = record => fs.writeFileSync(recordFile,JSON.stringify(record,null,2));
async function withRole(browser, baseURL, role, action) {
  const context = await browser.newContext({baseURL,storageState:path.join(dir,`${role}.json`)});
  try { return await action(await context.newPage()); } finally { await context.close(); }
}
test('SAN-001 deployed Admin build equals the explicitly confirmed QC identifier', async ({page}) => {
  test.skip(!process.env.YORENT_QC_BUILD_ID, 'Confirm the PMS QC request against Admin and supply YORENT_QC_BUILD_ID for this build.');
  await page.goto('/admin/home');
  await expect(page.locator('footer')).toContainText(process.env.YORENT_QC_BUILD_ID);
  const versions = (await page.locator('footer').innerText()).match(/TV-[\d.]+/g);
  expect(versions).toEqual([process.env.YORENT_QC_BUILD_ID]);
});
test('SAN-009 SAN-025 enabled duration pricing propagates to exact retained inventories', async ({page,browser},info) => {
  await page.goto('/admin/configurations');
  await page.getByRole('link',{name:'Product',exact:true}).click();
  const types = page.locator('input[name="CONF_DURATION_TYPES[]"]');
  await expect(types).toHaveCount(4);
  const enabled = await types.evaluateAll(es=>es.filter(e=>e.checked).map(e=>e.value));
  expect(enabled.length).toBeGreaterThan(0);
  const fields = {'1':['Hourly Rental Price','hourlyPrice'],'2':['Daily Rental Price','dailyPrice'],'3':['Weekly Rental Price','weeklyPrice'],'4':['Monthly Rental Price','monthlyPrice']};
  await withRole(browser,info.project.use.baseURL,'seller',async p=>{
    await p.goto('/en/account/profile-info');
    await expect(p.locator('input[name=user_name]')).toHaveValue(seller.name);
    for(const source of ['admin','seller']) {
      const stock=data.inventory[source];
      await p.goto(`/en/seller-inventories/seller-product-form/${stock.catalogId}/${stock.id}/0`);
      const form=p.locator('form[name=frmSellerProduct]');
      await expect(form.locator('[name=selprod_product_id]')).toHaveValue(stock.catalogId);
      await expect(form.locator('[name=selprod_title1]')).toHaveValue(stock.title);
      for(const [id,[placeholder,key]] of Object.entries(fields)) {
        const field=form.getByPlaceholder(placeholder,{exact:true});
        if(enabled.includes(id)) {
          await expect(field).toBeVisible();
          expect(Number(await field.inputValue())).toBe(Number(stock[key]));
        } else await expect(field).toHaveCount(0);
      }
    }
  });
  await info.attach('enabled-duration-evidence',{body:JSON.stringify({run,sellerId:data.sellerId,enabled,inventoryIds:Object.values(data.inventory).map(x=>x.id)}),contentType:'application/json'});
});
test('SAN-023 seller creates and reloads an exact unique one-off rental add-on', async ({browser},info) => {
  const record=records();
  record.addon ||= {title:`QA Addon ${run}`,price:'7.25',phase:'new'};
  const addon=record.addon;
  if(addon.phase==='submitted') throw new Error('Reconcile the saved add-on submission before replay; never create a duplicate.');
  await withRole(browser,info.project.use.baseURL,'seller',async p=>{
    await p.goto('/en/account/profile-info');
    await expect(p.locator('input[name=user_name]')).toHaveValue(seller.name);
    if(addon.phase==='new') {
      await p.goto('/en/addon-products/form');
      const form=p.locator('form[name=addonProductsForm]');
      await form.locator('[name=addon_identifier]').fill(addon.title);
      await form.locator('[name="addonprod_title[1]"]').fill(addon.title);
      await form.locator('[name=addon_price_type][value="1"]').check();
      await form.locator('[name=addonprod_price]').fill(addon.price);
      await form.locator('[name=sprodata_rental_active]').selectOption('1');
      addon.phase='submitted';persist(record);
      const saved=p.waitForResponse(r=>r.request().method()==='POST' && /\/addon-products\//.test(new URL(r.url()).pathname));
      await form.locator('[name=btn_submit]').click();
      expect((await saved).ok()).toBe(true);
      // Reopen the list and locate only our exact unique title.
      await p.goto('/en/addon-products');
      const row=p.locator('tr').filter({has:p.getByText(addon.title,{exact:true})});
      await expect(row).toHaveCount(1);
      const edit=row.getByTitle('Edit',{exact:true});
      addon.href=await edit.getAttribute('href');
      expect(addon.href).toMatch(/\/addon-products\/form\/[1-9]\d*$/);
      addon.id=addon.href.match(/\/(\d+)$/)[1];
      addon.phase='saved';persist(record);
    }
    await p.goto(addon.href);
    const form=p.locator('form[name=addonProductsForm]');
    await expect(form.locator('[name=addonprod_id]')).toHaveValue(addon.id);
    await expect(form.locator('[name=addon_identifier]')).toHaveValue(addon.title);
    await expect(form.locator('[name="addonprod_title[1]"]')).toHaveValue(addon.title);
    expect(Number(await form.locator('[name=addonprod_price]').inputValue())).toBe(Number(addon.price));
    await expect(form.locator('[name=addon_price_type][value="1"]')).toBeChecked();
    await expect(form.locator('[name=sprodata_rental_active]')).toHaveValue('1');
  });
  await info.attach('retained-addon',{body:JSON.stringify({run,sellerId:data.sellerId,addon}),contentType:'application/json'});
});
