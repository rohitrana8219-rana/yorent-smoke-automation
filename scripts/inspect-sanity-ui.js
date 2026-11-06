// Read-only discovery: no form submissions or policy changes.
require('dotenv').config({ quiet: true });
const fs = require('fs');
const { chromium, expect } = require('@playwright/test');
async function main() {
  const browser = await chromium.launch();
  const results = [];
  try {
    for (const role of ['admin', 'seller']) {
      const context = await browser.newContext({ baseURL: process.env.YORENT_BASE_URL, storageState: `.auth/${role}.json` });
      const page = await context.newPage();
      await page.goto(role === 'admin' ? '/admin/home' : '/en/seller', { waitUntil: 'domcontentloaded' });
      if (/login-form/.test(page.url())) throw new Error(`${role} storage state expired; rerun after role setup.`);
      const links = await page.locator('a[href]').evaluateAll(es => es.map(e => ({ text:e.textContent.trim(), href:e.getAttribute('href') })).filter(x => /duration|add.on|calendar|holiday|quote|rfq|commission|shipping|configuration/i.test(x.text+' '+x.href)));
      results.push({role, route:new URL(page.url()).pathname, links});
      for (const href of [...new Set(links.map(x=>x.href).filter(x=>x.startsWith('/') && !/logout|delete/i.test(x)))]) {
        await page.goto(href,{waitUntil:'domcontentloaded'});
        await expect(page.locator('.loaderJs')).toHaveCount(0);
        if (href === '/admin/configurations') {
          for (const label of ['Product','Account']) {
            await page.getByRole('link',{name:label,exact:true}).click();
            await expect(page.locator('form input[name=btn_submit]')).toBeVisible();
            results.push({role,route:href,tab:label,text:await page.locator('main').innerText(),html:await page.locator('main').innerHTML()});
          }
        }
        results.push({role,route:new URL(page.url()).pathname,text:(await page.locator('body').innerText()).slice(-18000),controls:await page.locator('input:not([type=password]):not([type=hidden]),select,button').evaluateAll(es=>es.map(e=>({tag:e.tagName,name:e.name,type:e.type,text:e.tagName==='SELECT'?e.innerText:e.tagName==='BUTTON'?e.textContent:null}))) });
      }
      await context.close();
    }
    fs.mkdirSync('tmp/sanity-audit',{recursive:true});
    fs.writeFileSync('tmp/sanity-audit/ui.json',JSON.stringify(results,null,2));
    console.log(results.map(x=>({role:x.role,route:x.route,links:x.links,controls:x.controls})));
  } finally {
    fs.mkdirSync('tmp/sanity-audit',{recursive:true});
    fs.writeFileSync('tmp/sanity-audit/ui.json',JSON.stringify(results,null,2));
    await browser.close();
  }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
