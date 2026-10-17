import React,{useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Contract,ContractFactory,JsonRpcProvider,parseEther,formatEther,type JsonRpcSigner} from 'ethers';
import abi from './generated/TokenMarket.json';
import tokenAbi from './generated/DemoToken.json';
import initial from './market-deployment.json';
import {send,injected,errorText,short} from './chain';
import './market.css';
type Listing={id:bigint;seller:string;buyer:string;title:string;amount:bigint;price:bigint;status:bigint};
const fmt=(v:bigint)=>Number(formatEther(v)).toLocaleString(undefined,{maximumFractionDigits:4});
function App(){
 const [cfg,setCfg]=useState(()=>{try{return JSON.parse(localStorage.getItem('aureum:market')||'null')||initial}catch{return initial}});
 const [signer,setSigner]=useState<JsonRpcSigner|null>(null),[account,setAccount]=useState(''),[balance,setBalance]=useState('');
 const [rows,setRows]=useState<Listing[]>([]),[page,setPage]=useState(0),[total,setTotal]=useState(0),[filter,setFilter]=useState('全部商品');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[title,setTitle]=useState(''),[amount,setAmount]=useState('100'),[price,setPrice]=useState('50');
 const [settings,setSettings]=useState(false),[draft,setDraft]=useState(JSON.stringify(cfg,null,2));
 const provider=useMemo(()=>new JsonRpcProvider(cfg.rpcUrl),[cfg]);
 const ready=cfg.market&&cfg.asset&&cfg.currency;
 const market=(s:JsonRpcSigner|JsonRpcProvider=provider)=>new Contract(cfg.market,abi,s);
 const token=(a:string,s:JsonRpcSigner|JsonRpcProvider=provider)=>new Contract(a,tokenAbi,s);
 function save(c:typeof initial){localStorage.setItem('aureum:market',JSON.stringify(c));setCfg(c);setDraft(JSON.stringify(c,null,2));}
 async function refresh(){if(!ready)return;const [r,n]=await Promise.all([market().listListings(page*24,24),market().listingCount()]);setRows(Array.from(r));setTotal(Number(n));if(account){const [a,c,m]=await Promise.all([token(cfg.asset).balanceOf(account),token(cfg.currency).balanceOf(account),provider.getBalance(account)]);setBalance(fmt(a)+' AUR · '+fmt(c)+' BLITZ · '+fmt(m)+' MON');}}
 useEffect(()=>{const read=()=>refresh().catch(e=>setMessage(errorText(e)));read();const timer=setInterval(read,5000);return()=>clearInterval(timer);},[cfg,page,account]);
 useEffect(()=>{const eth=(window as any).ethereum;if(!eth?.on)return;const reset=()=>{setSigner(null);setAccount('');setBalance('');};eth.on('accountsChanged',reset);eth.on('chainChanged',reset);return()=>{eth.removeListener?.('accountsChanged',reset);eth.removeListener?.('chainChanged',reset);};},[]);
 async function run(f:()=>Promise<void>){setBusy(true);setMessage('等待钱包签名与链上确认…');try{await f();await refresh();setMessage('操作已完成');}catch(e){setMessage(errorText(e));}finally{setBusy(false);}}
 async function connect(local=false){const s=local?await provider.getSigner(Number(prompt('本地钱包编号','0')||'0')):await injected({...cfg,token:cfg.currency,auction:cfg.market});setSigner(s);setAccount(await s.getAddress());}
 async function approve(a:string,n:bigint){if(!signer)throw Error('请连接钱包');const c=token(a,signer);if(await c.allowance(account,cfg.market)<n)await(await send(c,'approve',[cfg.market,n])).wait();}
 async function deploy(){if(!signer)throw Error('请连接钱包');const arts=await import('./generated/deploy.json');async function one(a:{abi:any;bytecode:string},args:unknown[]=[]){const f=new ContractFactory(a.abi,a.bytecode,signer!);const gas=await signer!.estimateGas(await f.getDeployTransaction(...args));const c=await f.deploy(...args,{gasLimit:gas+gas/10n});await c.waitForDeployment();return c.getAddress();}
 const asset=await one(arts.MarketAsset);setMessage('AUR 已部署 '+asset);const currency=await one(arts.DemoToken);setMessage('支付币已部署 '+currency);const m=await one(arts.TokenMarket,[asset,currency]);save({...cfg,asset,currency,market:m});}
 const visible=rows.filter(l=>filter==='我的发布'?l.seller.toLowerCase()===account.toLowerCase():filter==='我的购买'?l.buyer.toLowerCase()===account.toLowerCase():filter==='在售商品'?Number(l.status)===0:true);
 return <><nav><b>AUREUM <small>闲币集市</small></b><div><small>{account?short(account)+' / '+balance:'Monad Testnet'}</small><button disabled={busy} onClick={()=>run(()=>connect())}>{account?'切换钱包':'连接钱包'}</button><button onClick={()=>setSettings(!settings)}>设置</button></div></nav><main>
 <header><p>MONAD · 虚拟币交易集市</p><h1>让闲置代币，遇见新主人。</h1><p>固定价格 · 整单购买 · 链上托管与即时交付</p><small>演示使用无实际价值的测试币：商品 AUR，支付 BLITZ。</small></header>
 {settings&&<section><h2>网络与部署</h2><textarea aria-label="网络配置" rows={7} value={draft} onChange={e=>setDraft(e.target.value)}/><div className="actions"><button disabled={busy} onClick={()=>run(async()=>{const c=JSON.parse(draft);if(![10143,31337].includes(c.chainId)||!/^https?:/.test(c.rpcUrl))throw Error('仅支持测试网与本地链');save(c);setSigner(null);setAccount('');})}>保存配置</button>{cfg.chainId===31337&&<button disabled={busy} onClick={()=>run(()=>connect(true))}>本地演示钱包</button>}<button disabled={busy||!signer} onClick={()=>run(deploy)}>部署两种测试币和市场（3 笔）</button></div><small>地址仅保存在本机；公共发布需要同步公共配置。</small></section>}
 <p role="status" className="notice">{message||(!ready?'尚未配置市场，请打开设置部署或填入地址。':'每 5 秒刷新链上状态')}</p>
 {account&&ready&&<section><h2>发布代币商品</h2><form onSubmit={e=>{e.preventDefault();run(async()=>{const a=parseEther(amount),p=parseEther(price);if(a<=0n||p<=0n)throw Error('数量与价格须大于零');await approve(cfg.asset,a);await(await send(market(signer!),'createListing',[title,a,p])).wait();setTitle('');});}}><label>商品标题<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>数量 AUR<input required value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>整单售价 BLITZ<input required value={price} onChange={e=>setPrice(e.target.value)}/></label><button disabled={busy}>授权并发布</button></form><div className="actions"><button disabled={busy} onClick={()=>run(async()=>{await(await send(token(cfg.asset,signer!),'faucet')).wait();})}>领取测试 AUR</button><button disabled={busy} onClick={()=>run(async()=>{await(await send(token(cfg.currency,signer!),'faucet')).wait();})}>领取测试 BLITZ</button></div></section>}
 <div className="tabs">{['全部商品','在售商品','我的发布','我的购买'].map(t=><button key={t} className={t===filter?'active':''} onClick={()=>setFilter(t)}>{t}</button>)}<small>{total} 件商品</small></div>
 <div className="grid">{visible.map(l=><article key={String(l.id)}><div className="coin">A<span>数字资产 / AUR</span></div><small>#{String(l.id)} · {['在售','已成交','已下架'][Number(l.status)]}</small><h2>{l.title}</h2><p>{fmt(l.amount)} AUR</p><h3>{fmt(l.price)} <small>BLITZ / 整单</small></h3><small>卖家 {short(l.seller)}</small><div className="actions">{Number(l.status)===0&&(l.seller.toLowerCase()===account.toLowerCase()?<button disabled={busy||!signer} onClick={()=>run(async()=>{await(await send(market(signer!),'cancel',[l.id])).wait();})}>下架取回</button>:<button disabled={busy||!signer} onClick={()=>run(async()=>{await approve(cfg.currency,l.price);await(await send(market(signer!),'buy',[l.id])).wait();})}>授权并购买</button>)}</div></article>)}</div>
 {!visible.length&&<section>当前页暂无符合条件的商品</section>}<div className="actions"><button disabled={!page} onClick={()=>setPage(p=>p-1)}>上一页</button><small>第 {page+1} 页 · 筛选当前页</small><button disabled={(page+1)*24>=total} onClick={()=>setPage(p=>p+1)}>下一页</button></div><footer>商品与交易记录存储于链上 · 无后端数据库</footer></main></>;
}
createRoot(document.getElementById('root')!).render(<App/>);
