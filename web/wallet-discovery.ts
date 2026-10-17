import {useCallback,useEffect,useState} from 'react';
export type WalletProvider={request:(args:{method:string;params?:unknown[]})=>Promise<unknown>;on?:(name:string,callback:()=>void)=>void;removeListener?:(name:string,callback:()=>void)=>void;isMetaMask?:boolean;isRabby?:boolean;providers?:WalletProvider[]};
export type DiscoveredWallet={id:string;name:string;provider:WalletProvider};
export function useWalletDiscovery(){
 const [wallets,setWallets]=useState<DiscoveredWallet[]>([]);
 const add=useCallback((wallet:DiscoveredWallet)=>setWallets(old=>old.some(w=>w.provider===wallet.provider||w.id===wallet.id)?old:[...old,wallet]),[]);
 const refresh=useCallback(()=>{
  window.dispatchEvent(new Event('eip6963:requestProvider'));
  const legacy=(window as unknown as {ethereum?:WalletProvider}).ethereum;
  for(const [i,p] of (legacy?.providers??(legacy?[legacy]:[])).entries())if(typeof p?.request==='function')add({id:'legacy-'+i,name:p.isRabby?'Rabby':p.isMetaMask?'MetaMask':'浏览器钱包',provider:p});
 },[add]);
 useEffect(()=>{
  const announced=(event:Event)=>{const d=(event as CustomEvent).detail;if(typeof d?.provider?.request==='function'&&typeof d?.info?.uuid==='string'&&typeof d?.info?.name==='string')add({id:d.info.uuid,name:d.info.name.slice(0,80),provider:d.provider});};
  window.addEventListener('eip6963:announceProvider',announced);window.addEventListener('ethereum#initialized',refresh);window.addEventListener('focus',refresh);refresh();
  const timer=setTimeout(refresh,1000);
  return()=>{clearTimeout(timer);window.removeEventListener('eip6963:announceProvider',announced);window.removeEventListener('ethereum#initialized',refresh);window.removeEventListener('focus',refresh);};
 },[add,refresh]);
 return {wallets,refresh};
}
