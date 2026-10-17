import React,{useEffect,useState} from 'react';
import {Contract,formatEther,type JsonRpcProvider} from 'ethers';
import hubAbi from '../web/generated/CreationHub.json';

export function PublishGasPreview({provider,hub,account,args,chainId}:{provider:JsonRpcProvider;hub:string;account:string;args:[string,string,string,string,number];chainId:number}){
 const requestKey=JSON.stringify([hub,account,args,chainId]);
 const [result,setResult]=useState<{key:string;gas?:string;estimated?:string;maximum?:string;error?:string}|null>(null);
 useEffect(()=>{
  let active=true;
  const timer=setTimeout(async()=>{
   if(!hub||!account||args.slice(0,3).some(s=>!String(s).trim()))return;
   try{
    if((await provider.getNetwork()).chainId!==BigInt(chainId))throw Error('Wrong network');
    const c=new Contract(hub,hubAbi,provider);
    const [estimate,fees]=await Promise.all([c.publish.estimateGas(...args,{from:account}),provider.getFeeData()]);
    if(fees.gasPrice===null)throw Error('Gas price unavailable');
    const gas=estimate+estimate/10n;
    if(active)setResult({key:requestKey,gas:gas.toString(),estimated:formatEther(gas*fees.gasPrice),maximum:formatEther(gas*(fees.maxFeePerGas??fees.gasPrice))});
   }catch{if(active)setResult({key:requestKey,error:'暂无法估算，请检查正文长度、网络和钱包余额；未发送交易。'});}
  },500);
  return()=>{active=false;clearTimeout(timer);};
 },[provider,requestKey]);
 const current=result?.key===requestKey?result:null;
 return <div className="gas-preview" aria-live="polite"><strong>发布费用预览</strong><p>正文 {new TextEncoder().encode(args[2]).length.toLocaleString()} / 6,000 UTF-8 字节</p>{current?.gas?<><p>Gas 上限（含 10% 余量）：{current.gas}</p><p>当前费率估算：{current.estimated} MON · 费用上限：{current.maximum} MON</p></>:<p>{current?.error||'填写标题、摘要和正文后自动估算。'}</p>}<small>{chainId===10143?'Monad 按 Gas 上限计费；估算随网络变化，以钱包最终确认参数为准。':'当前为本地 EVM 估算，不代表 Monad 测试网费用。'}</small></div>;
}
