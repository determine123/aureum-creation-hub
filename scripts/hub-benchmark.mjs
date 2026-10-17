import fs from 'node:fs';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,JsonRpcProvider,Contract,ContractFactory,formatEther,isAddress,parseEther} from 'ethers';
import {compile} from './compile.mjs';
import {publicProvider} from './public-provider.mjs';

// Public mode is estimate-only. It never signs, sends or requests private keys.
const publicMode=process.argv.includes('--testnet');
let provider,rpc;
const rows=[];
const output=compile();
const artifact=name=>output.contracts[`contracts/${name}.sol`][name];
try{
 let hub,token,signer;
 const report={recordedAt:new Date().toISOString(),scope:publicMode?'Monad testnet RPC estimates; no transactions sent':'Local Ganache EVM measurements; NOT Monad testnet performance',chainId:publicMode?10143:31337,publicTransactionsSent:false,rows};
 if(publicMode){
  const configPath=process.argv.includes('--config')?process.argv[process.argv.indexOf('--config')+1]:'web/hub-deployment.json';
  const c=JSON.parse(fs.readFileSync(configPath,'utf8'));
  const account=process.argv[process.argv.indexOf('--account')+1];
  if(c.chainId!==10143||!c.rpcUrl.startsWith('https://')||!isAddress(c.hub)||!isAddress(account))throw Error('Provide a verified chain-10143 config and --account <public address>. No private key is needed.');
  provider=publicProvider(c.rpcUrl);
  if((await provider.getNetwork()).chainId!==10143n)throw Error('RPC chain mismatch');
  if(await provider.getCode(c.hub)==='0x')throw Error('No hub bytecode');
  hub=new Contract(c.hub,artifact('CreationHub').abi,provider);
  report.hub=c.hub;report.account=account;
  const fees=await provider.getFeeData();if(fees.gasPrice===null)throw Error('Missing gas price');
  for(const bytes of [100,1000,6000]){
   const estimate=await hub.publish.estimateGas('Benchmark','Public RPC estimate','x'.repeat(bytes),'',0,{from:account});
   const gasLimit=estimate+estimate/10n;
   rows.push({operation:'publish',bodyUtf8Bytes:bytes,estimatedGas:estimate.toString(),gasLimit:gasLimit.toString(),gasPriceWei:fees.gasPrice.toString(),estimatedMon:formatEther(gasLimit*fees.gasPrice)});
  }
 }else{
  rpc=ganache.provider({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'}});
  provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;signer=await provider.getSigner(0);
  async function deploy(name,args=[]){const a=artifact(name),c=await new ContractFactory(a.abi,a.evm.bytecode.object,signer).deploy(...args);await c.waitForDeployment();return c;}
  token=await deploy('DemoToken');hub=await deploy('CreationHub',[await token.getAddress()]);
  async function measured(c,method,args,extra={}){
   const fn=c.getFunction(method),estimate=await fn.estimateGas(...args),gasLimit=estimate+estimate/10n;
   const start=performance.now(),tx=await fn(...args,{gasLimit}),r=await tx.wait();assert.equal(r.status,1);
   const row={operation:method,...extra,estimatedGas:estimate.toString(),gasLimit:gasLimit.toString(),gasUsed:r.gasUsed.toString(),gasPriceWei:r.gasPrice.toString(),evmFeeMon:formatEther(r.gasUsed*r.gasPrice),receiptMs:Math.round(performance.now()-start),transactionHash:tx.hash};rows.push(row);return row;
  }
  for(const bytes of [100,1000,6000])await measured(hub,'publish',['Benchmark','Local EVM measurement','x'.repeat(bytes),'',0],{bodyUtf8Bytes:bytes});
  const reader=await provider.getSigner(1);await(await token.connect(reader).faucet()).wait();await(await token.connect(reader).approve(await hub.getAddress(),parseEther('100'))).wait();
  const h=hub.connect(reader),snapshot=await rpc.request({method:'evm_snapshot',params:[]});
  const singles=[];
  for(const id of [0,1,2])singles.push(await measured(h,'support',[id,parseEther('1')],{comparison:'three single supports'}));
  assert.equal(await rpc.request({method:'evm_revert',params:[snapshot]}),true);
  const batch=await measured(h,'supportBatch',[[0,1,2],[parseEther('1'),parseEther('1'),parseEther('1')]],{comparison:'one batch of three; same pre-state as singles'});
  const singleGas=singles.reduce((n,r)=>n+BigInt(r.gasUsed),0n),batchGas=BigInt(batch.gasUsed);
  report.batchComparison={identicalStartingState:true,approvalExcludedFromBoth:true,recipientPattern:'three creations, same author',singleGas:singleGas.toString(),batchGas:batchGas.toString(),gasSaved:(singleGas-batchGas).toString(),savedPercent:Number(singleGas-batchGas)*100/Number(singleGas),note:'Local EVM result only. Batch execution is sequential, not a parallel-execution benchmark. No Ethereum/Monad cost comparison is inferred.'};
 }
 fs.mkdirSync('benchmarks',{recursive:true});
 const file=`benchmarks/${publicMode?'monad-estimates':'local-evm'}.json`;
 fs.writeFileSync(file,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{provider?.destroy();if(rpc)await rpc.disconnect();}
