import React,{useEffect,useState} from 'react';
import {formatEther,getAddress,isAddress} from 'ethers';

export const MON_FAUCET='https://faucet.monad.xyz/';
export const MON_RPC='https://testnet-rpc.monad.xyz';
const recordKey='aureum:mon-faucet-records';
type ClaimRecord=Record<string,{amount:string}>;
function records():ClaimRecord{
 let result:ClaimRecord={};try{result=JSON.parse(localStorage.getItem(recordKey)||'{}')||{};}catch{}
 const params=new URLSearchParams(location.search),address=params.get('address'),amount=params.get('claimed');
 if(address&&isAddress(address)&&amount&&/^\d{1,9}$/.test(amount))result[address.toLowerCase()]={amount};
 return result;
}
async function rpc(method:string,params:unknown[],signal:AbortSignal){
 const response=await fetch(MON_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal});
 if(!response.ok)throw Error('RPC 暂不可用（HTTP '+response.status+'）');
 const payload=await response.json();if(payload.error)throw Error(payload.error.message||'RPC 请求失败');
 if(typeof payload.result!=='string'||!/^0x[0-9a-f]+$/i.test(payload.result))throw Error('RPC 返回格式异常，未确认余额');
 return payload.result as string;
}
export async function readMonBalance(address:string,signal:AbortSignal){
 if(BigInt(await rpc('eth_chainId',[],signal))!==10143n)throw Error('RPC 并非 Monad 测试网，未确认余额');
 return BigInt(await rpc('eth_getBalance',[getAddress(address),'finalized'],signal));
}

export function FaucetPanel({account,hasWallet,onConnect}:{account:string;hasWallet:boolean;onConnect:()=>Promise<string>}){
 const [address,setAddress]=useState(()=>{const q=new URLSearchParams(location.search).get('address');if(q&&isAddress(q))return getAddress(q);return account;});
 const [claimed,setClaimed]=useState<ClaimRecord>(records),[nonce,setNonce]=useState(0),[balance,setBalance]=useState<bigint|null>(null);
 const [loading,setLoading]=useState(false),[connecting,setConnecting]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[checkedAt,setCheckedAt]=useState('');
 const valid=isAddress(address),normalized=valid?getAddress(address):'';
 const claim=valid?claimed[address.toLowerCase()]:undefined;
 useEffect(()=>{try{localStorage.setItem(recordKey,JSON.stringify(claimed));}catch{}},[claimed]);
 useEffect(()=>{if(!address&&account)setAddress(account);},[account]);
 useEffect(()=>{
  setBalance(null);setCheckedAt('');setError('');setLoading(false);
  if(!normalized)return;
  let active=true,running=false;let controller:AbortController|undefined;
  const update=async()=>{
   if(!active||running)return;running=true;controller=new AbortController();const timer=setTimeout(()=>controller?.abort(),8000);setLoading(true);
   try{const amount=await readMonBalance(normalized,controller.signal);if(active){setBalance(amount);setCheckedAt(new Date().toLocaleTimeString('zh-CN'));setError('');}}
   catch(e){if(active){setBalance(null);setError((e as Error).name==='AbortError'?'RPC 查询超时，请稍后刷新。':(e as Error).message);}}
   finally{clearTimeout(timer);running=false;if(active)setLoading(false);}
  };
  update();const interval=setInterval(()=>{if(!document.hidden)update();},15000);
  const focus=()=>{if(!document.hidden)update();};window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
  return()=>{active=false;controller?.abort();clearInterval(interval);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);};
 },[normalized,nonce]);
 async function connect(){setConnecting(true);setNotice('');try{const a=await onConnect();if(!valid)setAddress(a);setNotice('钱包已连接 Monad 测试网');}catch(e){setNotice((e as Error).message);}finally{setConnecting(false);}}
 return <div className="mon-faucet"><div className="eyebrow">MONAD TESTNET · GAS</div><h2>MON 测试币水龙头</h2><p className="form-note">MON 支付链上 Gas，BLITZ 用于站内打赏。输入地址即可查询 MON，查询不需要钱包签名。</p>
 <label>收款 / 查询地址<input aria-label="MON 查询地址" value={address} placeholder="0x…" onChange={e=>{setAddress(e.target.value.trim());setNotice('');}}/></label>
 <div className="faucet-actions"><button className="button outline" disabled={!valid} onClick={()=>navigator.clipboard.writeText(normalized).then(()=>setNotice('收款地址已复制')).catch(()=>setNotice('复制失败，请手动复制上方地址'))}>复制收款地址</button><button className="button outline" disabled={!valid||loading} onClick={()=>setNonce(n=>n+1)}>{loading?'正在查询…':'刷新 MON 余额'}</button></div>
 <div className="mon-balance" aria-live="polite"><small>Monad 测试网 · Chain ID 10143 · finalized</small><strong data-testid="mon-native-balance">{balance===null?'—':formatEther(balance)} <span>MON</span></strong><small>{checkedAt&&!error?'链上余额更新于 '+checkedAt+' · 每 15 秒刷新':valid?'等待链上余额确认':'请输入完整的钱包地址'}</small></div>
 {error&&<p className="faucet-error" role="alert">{error} 余额尚未确认，不会按 0 处理。</p>}
 {claim&&<div className="claim-record">已记录领取{claim.amount?' '+claim.amount+' MON':''}（用户记录）<small>这是领取记录，当前可用余额以上方链上查询为准。</small></div>}
 <ol className="faucet-steps"><li>复制收款地址。</li><li>在官方网页粘贴地址，按页面规则人工领取。</li><li>返回此页，自动刷新到账余额；也可点击“刷新 MON 余额”。</li></ol>
 <div className="faucet-actions"><a className="button gold" href={MON_FAUCET} target="_blank" rel="noopener noreferrer">{claim?'查看官方水龙头 ↗':'打开官方水龙头 ↗'}</a><button className="button outline" disabled={!valid||!!claim} onClick={()=>setClaimed(old=>({...old,[normalized.toLowerCase()]:{amount:''}}))}>{claim?'已记录领取':'标记我已领取'}</button>{valid&&<a className="text-button" href={'https://testnet.monadscan.com/address/'+normalized} target="_blank" rel="noopener noreferrer">查看链上地址 ↗</a>}</div>
 <p className="form-note">领取额度和间隔以官方页面为准。本站只提供跳转与只读查询，不自动发起申领。</p>
 <div className="faucet-wallet"><strong>下一步：连接钱包并部署</strong><p className="form-note">{account?'已连接：'+account:'尚未连接钱包。查看余额不代表已获得签名权限。'}</p>{account&&valid&&account.toLowerCase()!==normalized.toLowerCase()&&<p className="faucet-error">当前钱包与查询地址不同。查询地址里的 MON 无法由当前钱包直接使用。</p>}<button className="button outline" disabled={!hasWallet||connecting} onClick={connect}>{connecting?'等待钱包确认…':'连接钱包并切到 Monad 测试网'}</button>{!hasWallet&&<p className="form-note">当前未检测到钱包扩展，请在装有 MetaMask/Rabby 的浏览器中连接。</p>}</div>
 {notice&&<p className="faucet-notice" role="status">{notice}</p>}</div>;
}
