require('dotenv').config({quiet:true});
const fs=require('fs');
const {chromium,expect}=require('@playwright/test');
async function main(){
 const browser=await chromium.launch(); const out=[];
 const capture=async(page,label)=>out.push({label,path:new URL(page.url()).pathname,text:(await page.locator('main,.modal.show,.ui-autocomplete:visible').allTextContents()).join('\n'),html:await page.locator('main,.modal.show,.ui-autocomplete:visible').evaluateAll(es=>es.map(e=>e.outerHTML).join('\n'))});
 try {
  const admin=await browser.newContext({baseURL:process.env.YORENT_BASE_URL,storageState:'.auth/admin.json'});const a=await admin.newPage();
  await a.goto('/admin/configurations');await a.getByRole('link',{name:'Product',exact:true}).click();await expect(a.locator('[name="CONF_DURATION_TYPES[]"]')).toHaveCount(4);await capture(a,'durations');
  await a.getByRole('link',{name:'Account',exact:true}).click();await expect(a.locator('[name=CONF_ADMIN_APPROVAL_SUPPLIER_REGISTRATION]')).toBeVisible();await capture(a,'approval');
  const account=JSON.parse(fs.readFileSync('.auth/seller-account.json'));
  const seller=await browser.newContext({baseURL:process.env.YORENT_BASE_URL,storageState:'.auth/seller.json'});const s=await seller.newPage();
  await s.goto('/en/seller');out.push({label:'seller-links',links:await s.locator('a[href]').evaluateAll(es=>es.map(e=>({text:e.textContent.trim(),href:e.getAttribute('href')})))});
  await s.goto('/en/seller-inventories/products');const form=s.locator('form[name=frmSearch]');await form.locator('[name=keyword]').fill(account.inventories.admin.title);await form.locator('[name=btn_submit]').click();
  const row=s.locator('tr').filter({has:s.getByText(account.inventories.admin.title,{exact:true})});await expect(row).toHaveCount(1);await row.getByTitle('Edit',{exact:true}).click();await expect(s.locator('form[name=frmSellerProduct]')).toBeVisible();await capture(s,'inventory');
  for(const route of ['/en/addon-products','/en/attach-addon-poducts','/en/seller-holidays']) {
   await s.goto(route);await expect(s.locator('main')).toBeVisible();await capture(s,route);
   out.push({label:route+'-actions',actions:await s.locator('main a,main button').evaluateAll(es=>es.map(e=>({tag:e.tagName,text:e.textContent.trim(),href:e.getAttribute('href'),onclick:e.getAttribute('onclick'),title:e.title})))});
  }
  await s.getByRole('button',{name:'Add Event',exact:true}).click();await expect(s.locator('.modal.show form')).toBeVisible();await capture(s,'holiday-form');
  await s.goto('/en/addon-products/form');await expect(s.locator('form[name]')).not.toHaveCount(0);await capture(s,'addon-form');
  await s.goto('/en/attach-addon-poducts');
  const lookup=s.waitForResponse(r=>r.request().method()==='POST' && /addon/.test(new URL(r.url()).pathname));
  await s.getByPlaceholder('Search Rental Addons',{exact:true}).pressSequentially('QA Addon 0cf4febb');
  await (await lookup).finished();await capture(s,'addon-autocomplete');
  await expect(s.getByText('QA Addon 0cf4febb',{exact:true})).toBeVisible();
  await s.getByText('QA Addon 0cf4febb',{exact:true}).click();
  await s.getByPlaceholder('Search Product',{exact:true}).fill(account.inventories.admin.title);
  await expect(s.locator('#treeview')).toContainText(account.inventories.admin.title);
  await capture(s,'addon-link-tree');
  const run=JSON.parse(fs.readFileSync('.auth/smoke-checklist/0cf4febb.json')).refundRun;
  const data=JSON.parse(fs.readFileSync(`.auth/rental/runs/${run}/journey.json`));
  const buyer=await browser.newContext({baseURL:process.env.YORENT_BASE_URL,storageState:`.auth/rental/runs/${run}/buyer.json`});const b=await buyer.newPage();
  await b.goto(`/en/buyer/view-order/${data.order.id}/${data.lines.admin.id}`);await capture(b,'refund-order-extension-controls');
 } finally {fs.writeFileSync('tmp/sanity-audit/details.json',JSON.stringify(out,null,2));await browser.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
