import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
const url=process.argv[2];if(!url||!url.startsWith('https://'))throw Error('Supply the real HTTPS deployment URL');
let proxy;
try{const value=execFileSync('powershell.exe',['-NoProfile','-Command',"$p=Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';if($p.ProxyEnable -eq 1){$p.ProxyServer}"],{encoding:'utf8',windowsHide:true}).trim();if(/^[a-zA-Z0-9.\-]+:\d+$/.test(value))proxy={server:'http://'+value};}catch{}
const browser=await chromium.launch({channel:'msedge',headless:true,...(proxy?{proxy}:{})});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage(),errors=[],badAssets=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/\/assets\//.test(r.url())&&!r.ok())badAssets.push({url:r.url(),status:r.status()});});
 const response=await page.goto(url,{waitUntil:'networkidle',timeout:45000});assert.equal(response.status(),200);
 await page.locator('h1').filter({hasText:'每一个好想法'}).waitFor();
 assert.equal(await page.getByRole('button',{name:'连接钱包',exact:true}).count(),1);
 assert.equal(await page.evaluate(()=>getComputedStyle(document.body).margin),'0px');
 fs.mkdirSync('qa-hub',{recursive:true});await page.screenshot({path:'qa-hub/public-home.png',fullPage:true});
 await page.goto(new URL('?deploy=1',url).href,{waitUntil:'networkidle'});
 await page.getByRole('heading',{name:'Monad 测试网部署向导',exact:true}).waitFor();
 await page.getByText('已检测到 0 个钱包',{exact:true}).waitFor();
 await page.screenshot({path:'qa-hub/public-wallet-setup.png',fullPage:true});
 await page.getByRole('button',{name:'关闭窗口',exact:true}).click();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);assert.deepEqual(badAssets,[]);
 fs.writeFileSync('qa-hub/public-result.json',JSON.stringify({passed:true,url,anonymousAccess:true,scope:'Public frontend and wallet setup only; public contract transactions not yet verified',pageErrors:errors,badAssets,mobileOverflow:false},null,2));
 console.log('Anonymous public frontend, subpath assets, wallet setup and mobile layout passed.');
}finally{await browser.close();}
