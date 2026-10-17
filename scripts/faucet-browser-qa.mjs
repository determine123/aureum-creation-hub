import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','15178','--strictPort'],{stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:15178')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
 await context.addInitScript(()=>localStorage.setItem('aureum:hub:v1',JSON.stringify({chainId:10143,rpcUrl:'https://testnet-rpc.monad.xyz',token:'',hub:''})));
 const p=await context.newPage();await p.clock.install();
 let balance=0n,chain='0x279f',failure=false,balanceReads=0,officialRequests=0;
 const methods=[],errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().startsWith('https://faucet.monad.xyz'))officialRequests++;});
 await p.route('https://testnet-rpc.monad.xyz/',async route=>{
  const request=route.request().postDataJSON();methods.push(request.method);
  assert.ok(['eth_chainId','eth_getBalance'].includes(request.method),'Only read-only RPC methods are allowed');
  if(request.method==='eth_getBalance'){balanceReads++;assert.equal(request.params[1],'finalized');}
  if(failure&&request.method==='eth_getBalance')return route.fulfill({status:503,body:'Unavailable'});
  return route.fulfill({json:{jsonrpc:'2.0',id:request.id,result:request.method==='eth_chainId'?chain:'0x'+balance.toString(16)}});
 });
 const address='0x1111111111111111111111111111111111111111';
 await p.goto('http://127.0.0.1:15178/?faucet=1&address='+address+'&claimed=100');
 const panel=p.getByRole('dialog',{name:'MON 水龙头',exact:true});await panel.waitFor();
 await panel.getByTestId('mon-native-balance').filter({hasText:'0.0 MON'}).waitFor();
 await panel.getByText('已记录领取 100 MON（用户记录）',{exact:false}).waitFor();
 assert.equal(await panel.getByRole('link',{name:'查看官方水龙头',exact:false}).getAttribute('href'),'https://faucet.monad.xyz/');
 assert.equal(await panel.getByRole('button',{name:'已记录领取',exact:true}).isDisabled(),true);
 await panel.getByRole('button',{name:'复制收款地址',exact:true}).click();assert.equal(await p.evaluate(()=>navigator.clipboard.readText()),address);
 balance=100n*10n**18n;await p.clock.fastForward(15001);
 await panel.getByTestId('mon-native-balance').filter({hasText:'100.0 MON'}).waitFor();
 assert.ok(balanceReads>=2,'15-second automatic balance refresh must run');
 await panel.getByLabel('MON 查询地址',{exact:true}).fill('invalid');const reads=balanceReads;await p.clock.fastForward(30001);assert.equal(balanceReads,reads);
 failure=true;await panel.getByLabel('MON 查询地址',{exact:true}).fill(address);
 await panel.getByRole('alert').filter({hasText:'RPC 暂不可用'}).waitFor();assert.match(await panel.getByTestId('mon-native-balance').innerText(),/—/);
 failure=false;balance=99n*10n**18n;await p.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await panel.getByTestId('mon-native-balance').filter({hasText:'99.0 MON'}).waitFor();
 chain='0x8f';await panel.getByRole('button',{name:'刷新 MON 余额',exact:true}).click();
 await panel.getByRole('alert').filter({hasText:'RPC 并非 Monad 测试网'}).waitFor();
 chain='0x279f';await panel.getByRole('button',{name:'刷新 MON 余额',exact:true}).click();
 await panel.getByTestId('mon-native-balance').filter({hasText:'99.0 MON'}).waitFor();
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 fs.mkdirSync('qa-hub',{recursive:true});await p.screenshot({path:'qa-hub/faucet-mobile.png',fullPage:true});
 assert.equal(officialRequests,0);assert.deepEqual(errors,[]);
 fs.writeFileSync('qa-hub/faucet-result.json',JSON.stringify({passed:true,mockedRPC:true,checks:['claimed amount is separate from chain balance','no wallet required to read balance','15-second polling','copy address','invalid address does not query','RPC failures never become zero balances','refresh on focus','mainnet RPC rejected','no automatic faucet claims','390px no overflow'],pageErrors:errors},null,2));
 console.log('MON faucet integration passed using controlled RPC responses. No live claims or transactions sent.');
}finally{if(browser)await browser.close();vite.kill();}
