import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import {createDemo} from './hub-demo.mjs';
const demo=await createDemo(18647,10143); // Simulated network only, never public-testnet evidence.
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','15177','--strictPort'],{stdio:'ignore',windowsHide:true});
let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:15177')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const ctx=await browser.newContext();
 const addresses=await Promise.all([0,1].map(async i=>(await demo.provider.getSigner(i)).getAddress()));
 await ctx.addInitScript(({config,addresses})=>{
  localStorage.setItem('aureum:hub:v1',JSON.stringify({...config,token:'',hub:''}));
  window.__sendAttempts=0;
  const providers=addresses.map(address=>({request:async({method,params=[]})=>{
   if(method==='eth_requestAccounts'||method==='eth_accounts')return [address];
   if(method==='wallet_switchEthereumChain')return null;
   if(method==='eth_sendTransaction'&&++window.__sendAttempts===2){const e=new Error('User rejected');e.code=4001;throw e;}
   const r=await fetch(config.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();if(j.error)throw Error(j.error.message);return j.result;
  }}));
  window.addEventListener('eip6963:requestProvider',()=>providers.forEach((provider,i)=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'test-provider-'+i,name:i?'Rabby test':'MetaMask test'},provider}}))));
 },{config:demo.config,addresses});
 const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:15177/?deploy=1');
 await p.getByText('已检测到 2 个钱包',{exact:true}).waitFor();
 assert.equal(await p.evaluate(()=>typeof window.ethereum),'undefined');
 await p.getByLabel('选择部署钱包').selectOption('test-provider-1');
 await p.getByRole('button',{name:'连接浏览器钱包',exact:true}).click();
 await p.getByRole('status').filter({hasText:'连接测试网钱包完成'}).waitFor();
 assert.match(await p.locator('.wallet-balance').innerText(),new RegExp(addresses[1].slice(0,6)));
 await p.getByRole('button',{name:'钱包部署（2 笔，可续传）',exact:true}).click();
 await p.getByRole('status').filter({hasText:'取消钱包签名'}).waitFor();
 const partial=await p.evaluate(address=>JSON.parse(localStorage.getItem('aureum:hub:partial:10143:'+address.toLowerCase())),addresses[1]);
 assert.ok(partial.token);assert.equal(partial.hub,undefined);
 await p.getByRole('button',{name:'钱包部署（2 笔，可续传）',exact:true}).click();
 await p.getByRole('status').filter({hasText:'部署平台完成'}).waitFor();
 const cfg=await p.evaluate(()=>JSON.parse(localStorage.getItem('aureum:hub:v1')));
 assert.equal(cfg.token,partial.token);assert.ok(cfg.hub);assert.notEqual(await demo.provider.getCode(cfg.hub),'0x');
 assert.equal(await p.evaluate(()=>window.__sendAttempts),3);assert.deepEqual(errors,[]);
 fs.mkdirSync('qa-hub',{recursive:true});fs.writeFileSync('qa-hub/wallet-result.json',JSON.stringify({passed:true,simulatedNetwork:true,checks:['EIP6963 without window.ethereum','multiple wallet selection','real local deployments','rejected second deployment resumes without redeploying token'],pageErrors:errors},null,2));
 console.log('Wallet discovery and resumable deployment passed on a simulated local network.');
}finally{if(browser)await browser.close();vite.kill();demo.provider.destroy();await demo.server.close();}
