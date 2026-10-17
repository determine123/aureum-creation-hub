import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {Contract,JsonRpcProvider,parseEther} from 'ethers';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
console.log('Launching headless browser...');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge',timeout:20000});
console.log('Browser ready.');
const provider=new JsonRpcProvider('http://127.0.0.1:8545');
const config=JSON.parse(fs.readFileSync('web/deployment.json','utf8'));
const auction=new Contract(config.auction,JSON.parse(fs.readFileSync('web/generated/BlindAuction.json','utf8')),provider);
const token=new Contract(config.token,JSON.parse(fs.readFileSync('web/generated/DemoToken.json','utf8')),provider);
const errors=[];const contexts=[];
fs.mkdirSync('qa',{recursive:true});
async function pageFor(index){
  const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});contexts.push(context);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  console.log(`Connecting account ${index}...`);
  await page.goto('http://127.0.0.1:5173/');
  await page.getByText('链上连接正常',{exact:false}).waitFor();
  await page.getByRole('button',{name:'连接钱包 ↗',exact:true}).click();
  await page.getByLabel('本地开发账户').selectOption(String(index));
  await page.getByRole('button',{name:'使用本地钱包（无需扩展）'}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});return page;
}
async function done(page,text){await page.getByRole('status').filter({hasText:text+'完成'}).waitFor({timeout:20000});}
async function approve(page,index){const address=await (await provider.getSigner(index)).getAddress();if(await token.allowance(address,config.auction)<parseEther('100000')){await page.getByRole('button',{name:'授权本次保证金',exact:true}).click();await done(page,'授权保证金');}}
async function advance(seconds){await provider.send('evm_increaseTime',[seconds]);await provider.send('evm_mine',[]);}
async function at(target){const block=await provider.send('eth_getBlockByNumber',['latest',false]);const seconds=Number(target)-Number(BigInt(block.timestamp));if(seconds>0)await advance(seconds);}
try{
  const seller=await pageFor(0);await seller.screenshot({path:'qa/lobby-desktop.png',fullPage:true});
  await seller.getByRole('button',{name:'＋ 发起竞拍',exact:true}).click();
  const dlg=seller.getByRole('dialog');
  await dlg.getByRole('button',{name:'领取测试代币',exact:true}).click();await done(seller,'领取测试代币');
  await approve(seller,0);
  const title=`黄金数字 · 密封竞拍 #${Number(await auction.auctionCount())+1}`;
  await dlg.getByLabel('竞拍名称').fill(title);
  await dlg.getByLabel('公开最高限价 / BLITZ').fill('1000');await dlg.getByLabel('保密实际价格 / BLITZ').fill('500');
  await dlg.getByRole('button',{name:'存入保证金并创建 ↗',exact:true}).click();
  await seller.getByRole('heading',{name:title,exact:true}).waitFor();await done(seller,'创建竞拍');
  const pages=[];
  for(const i of [1,2,3]){
    const page=await pageFor(i);pages.push(page);
    await page.getByRole('button',{name:`进入 ${title}`,exact:true}).click();
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
    await page.getByRole('button',{name:'领取测试代币',exact:true}).click();await done(page,'领取测试代币');
    await approve(page,i);
    await page.getByRole('button',{name:'存入保证金并报名 ↗',exact:true}).click();await done(page,'报名竞拍');
  }
  const id=Number(await auction.auctionCount());const start=(await auction.getAuction(id)).roundStart;
  await at(start+1n);
  for(let i=0;i<3;i++){
    const page=pages[i];await page.getByLabel('本轮报价',{exact:true}).waitFor({timeout:15000});
    await page.getByLabel('本轮报价',{exact:true}).fill(['300','100','50'][i]);
    await page.getByRole('button',{name:'提交密封报价 ↗',exact:true}).click();await done(page,'提交密封报价');
    if(i===0){const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'导出备份 ↓',exact:true}).click();await (await downloaded).saveAs('qa/buyer-reveal-test.json');}
  }
  await seller.screenshot({path:'qa/arena-sealed.png',fullPage:true});
  await at(start+31n);
  for(let i=0;i<pages.length;i++){const page=pages[i];await page.getByRole('button',{name:'揭露报价 ↗',exact:true}).waitFor({timeout:15000});if(i===0){await page.getByLabel('本轮报价',{exact:true}).fill('301');await page.locator('input[type=file]').setInputFiles('qa/buyer-reveal-test.json');assert.equal(await page.getByLabel('本轮报价',{exact:true}).inputValue(),'300');}await page.getByRole('button',{name:'揭露报价 ↗',exact:true}).click();await done(page,'揭露报价');}
  await seller.screenshot({path:'qa/arena-revealed.png',fullPage:true});
  await at(start+61n);
  await pages[2].getByRole('button',{name:'请求比价 / 推进下一轮 ↗',exact:true}).click({timeout:15000});await done(pages[2],'请求链上比价');
  const resultBefore=await auction.getAuction(id);
  const sellerBefore=await token.balanceOf(resultBefore.seller),winnerBefore=await token.balanceOf(resultBefore.winner);
  await seller.getByRole('button',{name:'揭露实际价格并结算 ↗',exact:true}).click({timeout:15000});await done(seller,'揭露实际价格');
  assert.equal(await token.balanceOf(resultBefore.seller),sellerBefore+parseEther('99800'));
  assert.equal(await token.balanceOf(resultBefore.winner),winnerBefore+parseEther('100200'));
  assert.equal(await auction.claimable(id,resultBefore.seller),0n);assert.equal(await auction.claimable(id,resultBefore.winner),0n);
  await seller.getByText('卖方 → 赢家：200 BLITZ',{exact:false}).waitFor();
  await seller.screenshot({path:'qa/settled-desktop.png',fullPage:true});
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,deviceScaleFactor:1});contexts.push(mobile);
  const mp=await mobile.newPage();await mp.goto('http://127.0.0.1:5173/');await mp.getByRole('button',{name:`进入 ${title}`,exact:true}).waitFor();
  await mp.screenshot({path:'qa/lobby-mobile.png',fullPage:true});
  await mp.getByRole('button',{name:`进入 ${title}`,exact:true}).click();await mp.getByRole('heading',{name:title,exact:true}).waitFor();
  await mp.screenshot({path:'qa/arena-mobile.png',fullPage:true});
  const overflow=await mp.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);if(overflow)throw Error('Mobile layout overflows viewport');
  if(errors.length)throw Error('Browser page errors: '+errors.join('; '));
  // Reveal data here is for a settled, local-only test auction. Never export production secrets this way.
  fs.writeFileSync('qa/result.json',JSON.stringify({passed:true,auctionId:id,flow:'create → 3 registrations → commit → backup export/import → reveal → outsider compare → seller reveal → refund',sellerRefund:'99800 BLITZ',winnerRefund:'100200 BLITZ',refundBalanceAssertions:true,mobileWidth:390,browserErrors:errors},null,2));
  console.log('Browser E2E passed: 4 wallets, actual contract transactions, seller pays 200 BLITZ, desktop + mobile screenshots.');
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();provider.destroy();}
