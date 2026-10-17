import fs from 'node:fs';
import {spawn} from 'node:child_process';
import ganache from 'ganache';
import {JsonRpcProvider,ContractFactory} from 'ethers';
import {chromium} from 'playwright';
const server=ganache.server({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'}});
await server.listen(18545);
const provider=new JsonRpcProvider('http://127.0.0.1:18545');provider.pollingInterval=50;
const seller=await provider.getSigner(0);
async function deploy(n,args=[]){const a=JSON.parse(fs.readFileSync('artifacts/'+n+'.json'));const c=await new ContractFactory(a.abi,a.evm.bytecode.object,seller).deploy(...args);await c.waitForDeployment();return c.getAddress();}
const asset=await deploy('MarketAsset'),currency=await deploy('DemoToken'),market=await deploy('TokenMarket',[asset,currency]);
const config={chainId:31337,rpcUrl:'http://127.0.0.1:18545',asset,currency,market};
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','15173'],{stdio:'ignore',windowsHide:true});
let browser;
try {
 for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:15173')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'msedge',headless:true});
 const errors=[];
 async function pageFor(index){
 const ctx=await browser.newContext();
 const address=await(await provider.getSigner(index)).getAddress();
 await ctx.addInitScript(({config,address})=>{
 localStorage.setItem('aureum:market',JSON.stringify(config));
 window.ethereum={request:async({method,params=[]})=>{
 if(method==='eth_requestAccounts'||method==='eth_accounts')return [address];
 if(method==='wallet_switchEthereumChain')return null;
 const res=await fetch(config.rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const out=await res.json();if(out.error)throw Error(out.error.message);return out.result;
 }};
 },{config,address});
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto('http://127.0.0.1:15173');await p.getByRole('button',{name:'连接钱包',exact:true}).click();await p.getByRole('heading',{name:'发布代币商品'}).waitFor();return p;
 }
 const s=await pageFor(0);
 await s.getByRole('button',{name:'领取测试 AUR',exact:true}).click();await s.getByRole('status').filter({hasText:'操作已完成'}).waitFor();
 await s.getByLabel('商品标题').fill('路演 AUR 礼包');
 await s.getByRole('button',{name:'授权并发布',exact:true}).click();
 await s.getByRole('heading',{name:'路演 AUR 礼包'}).waitFor();
 const b=await pageFor(1);
 await b.getByRole('button',{name:'领取测试 BLITZ',exact:true}).click();await b.getByRole('status').filter({hasText:'操作已完成'}).waitFor();
 await b.getByRole('button',{name:'授权并购买',exact:true}).click();
 await b.getByText('#0 · 已成交',{exact:true}).waitFor();
 await b.getByRole('button',{name:'我的购买',exact:true}).click();
 await b.getByRole('heading',{name:'路演 AUR 礼包'}).waitFor();
 fs.mkdirSync('qa-market',{recursive:true});await b.screenshot({path:'qa-market/desktop.png',fullPage:true});
 await b.setViewportSize({width:390,height:844});
 if(await b.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile overflow');
 await b.screenshot({path:'qa-market/mobile.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));
 fs.writeFileSync('qa-market/result.json',JSON.stringify({passed:true,config,pageErrors:errors},null,2));console.log('Browser E2E passed: connect, faucet, publish, purchase, own records, mobile layout.');
}finally{if(browser)await browser.close();vite.kill();provider.destroy();await server.close();}
