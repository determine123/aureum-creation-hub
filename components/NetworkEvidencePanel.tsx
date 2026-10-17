import React from 'react';
import {formatEther} from 'ethers';
import audit from '../deployment/testnet-audit.json';
import tokenVerification from '../verification/DemoToken.json';
import hubVerification from '../verification/CreationHub.json';

export function NetworkEvidencePanel({chainId,token,hub}:{chainId:number;token:string;hub:string}){
 const matches=chainId===10143&&token.toLowerCase()===audit.token.toLowerCase()&&hub.toLowerCase()===audit.hub.toLowerCase();
 return <section className="evidence-panel" aria-label="公共网络证据"><div className="eyebrow">CHECK THE NETWORK · CHECK THE EVIDENCE</div><h2>先看证据，再看承诺。</h2>{matches?<><p>当前配置指向已有归档核验的 Monad 测试网旧版合约，支持单笔流程；支持篮需要另行部署新版平台。</p><ul><li>DemoToken：<a target="_blank" rel="noreferrer" href={'https://testnet.monadscan.com/address/'+token+'#code'}>{token}</a> · {tokenVerification.verified===tokenVerification.total?'源码验证成功':'验证待确认'}</li><li>CreationHub：<a target="_blank" rel="noreferrer" href={'https://testnet.monadscan.com/address/'+hub+'#code'}>{hub}</a> · {hubVerification.verified===hubVerification.total?'源码验证成功':'验证待确认'}</li></ul><p>核验快照：区块 {audit.finalizedBlock.number} · {new Date(audit.recordedAt).toLocaleString('zh-CN')}。快照不是实时状态。</p><ul>{audit.rows.map(r=><li key={r.bodyUtf8Bytes}>{r.bodyUtf8Bytes.toLocaleString()} 字节正文：约 {formatEther(BigInt(r.estimatedFeeWei))} MON · Gas 上限 {r.gasLimit}</li>)}</ul><small>以上是当时费率下的 RPC 估算（含 10% Gas 余量），不是成交回执、确认速度或批量节省证明。</small></>:<p>{chainId===31337?'当前为本地演示，不能视为 Monad 公共网络证据。':'当前配置与已归档的核验地址不同，不能沿用旧地址的验证或费用结论。请重新核验。'}</p>}<p>部署、源码验证、RPC 估算和真实交易验收是不同步骤。报告上链只证明报告被记录，不证明应用交易流程通过。</p><a target="_blank" rel="noreferrer" href="https://github.com/determine123/aureum-creation-hub/blob/main/docs/REVIEWER-GUIDE.md">查看可复核材料与未完成项 ↗</a></section>;
}
