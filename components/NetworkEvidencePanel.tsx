import React from 'react';
import {formatEther} from 'ethers';
import audit from '../deployment/testnet-audit.json';
import simulation from '../benchmarks/monad-batch-simulation.json';
import tokenVerification from '../verification/DemoToken.json';
import hubVerification from '../verification/CreationHub.json';

export function NetworkEvidencePanel({chainId,token,hub,batchAvailable}:{chainId:number;token:string;hub:string;batchAvailable:boolean}){
 const legacy=chainId===10143&&token.toLowerCase()===audit.token.toLowerCase()&&hub.toLowerCase()===audit.hub.toLowerCase();
 const simulationMatches=chainId===10143&&token.toLowerCase()===simulation.token.toLowerCase();
 const comparison=simulation.comparisons.threeDifferentAuthors;
 return <section className="evidence-panel" aria-label="公共网络证据">
  <div className="eyebrow">CHECK THE NETWORK · CHECK THE EVIDENCE</div>
  <h2>先看证据，再看承诺。</h2>
  {chainId===10143&&token&&hub?<>
   <p>{batchAvailable?'当前配置指向新版批量 CreationHub；页面通过 MAX_SUPPORT_BATCH 读取能力，不把版本号写死。':'当前配置指向旧版单笔 CreationHub；支持篮需要部署新版平台。'}</p>
   <ul>
    <li>DemoToken：<a target="_blank" rel="noreferrer" href={'https://testnet.monadscan.com/address/'+token+'#code'}>{token}</a>{legacy?' · '+(tokenVerification.verified===tokenVerification.total?'源码验证成功':'验证待确认'):' · 验证状态以区块浏览器为准'}</li>
    <li>CreationHub：<a target="_blank" rel="noreferrer" href={'https://testnet.monadscan.com/address/'+hub+'#code'}>{hub}</a>{legacy?' · '+(hubVerification.verified===hubVerification.total?'源码验证成功':'验证待确认'):' · 新版部署后需重新验证'}</li>
   </ul>
   {legacy&&<><p>归档核验快照：区块 {audit.finalizedBlock.number} · {new Date(audit.recordedAt).toLocaleString('zh-CN')}。旧版核验不自动适用于新地址。</p><ul>{audit.rows.map(r=><li key={r.bodyUtf8Bytes}>{r.bodyUtf8Bytes.toLocaleString()} 字节正文：约 {formatEther(BigInt(r.estimatedFeeWei))} MON · Gas 上限 {r.gasLimit}</li>)}</ul></>}
   {simulationMatches&&<div className="simulation-evidence">
    <strong>新版字节码的 Monad 只读模拟</strong>
    <p>三位不同作者：单笔合计 {Number(comparison.singleGas).toLocaleString()} Gas；一笔批量 {Number(comparison.batchGas).toLocaleString()} Gas，估算节省 {comparison.savedPercent.toFixed(2)}%。20 项上限约 {Number(simulation.comparisons.twentyItemUpperBound.batchGas).toLocaleString()} Gas。</p>
    <small>通过 eth_estimateGas + state override 模拟，未发送交易、未部署模拟地址；不是回执、成交费用或确认速度。</small>
    <a target="_blank" rel="noreferrer" href="https://github.com/determine123/aureum-creation-hub/blob/main/benchmarks/monad-batch-simulation.json">查看模拟原始记录 ↗</a>
   </div>}
  </>:<p>{chainId===31337?'当前为本地演示，不能视为 Monad 公共网络证据。':'尚未配置完整的 Monad 测试网地址，不能展示公共网络结论。'}</p>}
  <p>部署、源码验证、RPC 估算和真实交易验收是不同步骤。报告上链只证明报告被记录，不证明应用交易流程通过。</p>
  <a target="_blank" rel="noreferrer" href="https://github.com/determine123/aureum-creation-hub/blob/main/docs/REVIEWER-GUIDE.md">查看可复核材料与未完成项 ↗</a>
 </section>;
}
