import fs from 'node:fs';
import {chromium} from 'playwright';
const url=process.argv[2]||'http://127.0.0.1:15175';
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});
 await page.goto(url);
 await page.locator('.creation-card').first().waitFor();
 await page.evaluate(()=>document.fonts.ready);
 fs.mkdirSync('submission/screenshots',{recursive:true});
 await page.screenshot({path:'submission/screenshots/01-cover.png',fullPage:false});
 await page.locator('.card-open').first().click();
 await page.getByRole('dialog',{name:'作品详情'}).waitFor();
 await page.screenshot({path:'submission/screenshots/02-detail.png',fullPage:false});
 console.log('Two landscape submission screenshots exported (1600×1100).');
}finally{await browser.close();}
