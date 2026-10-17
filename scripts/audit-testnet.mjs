import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import solc from 'solc';
import {AbiCoder,Interface} from 'ethers';
import {compile} from './compile.mjs';

const config=JSON.parse(fs.readFileSync('deployment/monad-testnet.json','utf8'));
compile();
const input=JSON.parse(fs.readFileSync('artifacts/standard-input.json','utf8'));
// This source revision predates supportBatch. Keep the current product source intact.
input.sources['contracts/CreationHub.sol'].content=execFileSync('git',['show','5d067e9:contracts/CreationHub.sol'],{encoding:'utf8'});
input.settings.outputSelection={'*':{'*':['abi','metadata','evm.deployedBytecode']}};
const out=JSON.parse(solc.compile(JSON.stringify(input)));
if(out.errors?.some(e=>e.severity==='error'))throw Error('Legacy source compilation failed');
const t=out.contracts['contracts/DemoToken.sol'].DemoToken,h=out.contracts['contracts/CreationHub.sol'].CreationHub;
const ti=new Interface(t.abi),hi=new Interface(h.abi);
const account='0x37F416f3945b1d40b888868b7C0B37605d446C1e';
const bodies=[100,1000,6000];
const calls=[['eth_chainId',[]],['eth_getCode',[config.token,'finalized']],['eth_getCode',[config.hub,'finalized']],['eth_gasPrice',[]],['eth_call',[{to:config.hub,data:hi.encodeFunctionData('token')},'finalized']],['eth_call',[{to:config.token,data:ti.encodeFunctionData('symbol')},'finalized']],['eth_call',[{to:config.token,data:ti.encodeFunctionData('decimals')},'finalized']],['eth_call',[{to:config.hub,data:hi.encodeFunctionData('creationCount')},'finalized']],...bodies.map(n=>['eth_estimateGas',[{to:config.hub,from:account,data:hi.encodeFunctionData('publish',['Benchmark','Monad RPC estimate','x'.repeat(n),'',0])}]]),['eth_getBlockByNumber',['finalized',false]]];
let responses;
for(let attempt=0;attempt<4;attempt++){
 try{
  const proxy=process.env.HTTPS_PROXY?['--proxy',process.env.HTTPS_PROXY]:[];
  responses=JSON.parse(execFileSync(process.platform==='win32'?'curl.exe':'curl',[...proxy,'--http1.1','--silent','--show-error','--fail','--connect-timeout','8','--max-time','20',config.rpcUrl,'-H','Content-Type: application/json','--data-raw',JSON.stringify(calls.map(([method,params],id)=>({jsonrpc:'2.0',id,method,params})))],{encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024}));break;
 }catch{console.log('Read-only audit retry '+(attempt+1));}
}
if(!responses)throw Error('Testnet RPC unavailable; no audit fabricated');
function result(id){const r=responses.find(r=>r.id===id);if(!r||r.error)throw Error('RPC '+id+' failed: '+JSON.stringify(r?.error));return r.result;}
if(BigInt(result(0))!==10143n)throw Error('Wrong chain');
if(hi.decodeFunctionResult('token',result(4))[0].toLowerCase()!==config.token.toLowerCase())throw Error('Token mismatch');
if(ti.decodeFunctionResult('symbol',result(5))[0]!=='BLITZ'||ti.decodeFunctionResult('decimals',result(6))[0]!==18n)throw Error('Currency mismatch');
function match(code,artifact){let actual=code.slice(2).toLowerCase(),expected=artifact.evm.deployedBytecode.object.toLowerCase();for(const ranges of Object.values(artifact.evm.deployedBytecode.immutableReferences||{}))for(const {start,length} of ranges){const a=start*2,b=(start+length)*2;actual=actual.slice(0,a)+'0'.repeat(length*2)+actual.slice(b);expected=expected.slice(0,a)+'0'.repeat(length*2)+expected.slice(b);}return actual===expected;}
const tokenMatch=match(result(1),t),hubMatch=match(result(2),h);if(!tokenMatch||!hubMatch)throw Error('Deployed runtime does not match audited source revision');
const block=result(11),price=BigInt(result(3));
const report={recordedAt:new Date().toISOString(),scope:'Live Monad testnet RPC audit and estimates; NO new transactions sent',chainId:10143,...config,account,finalizedBlock:{number:Number(BigInt(block.number)),hash:block.hash},tokenRuntimeMatches:true,hubRuntimeMatches:true,hubSourceRef:'5d067e9',hubVersion:'legacy, single support only',creationCount:String(hi.decodeFunctionResult('creationCount',result(7))[0]),publicTransactionsSent:false,rows:bodies.map((bytes,i)=>{const estimate=BigInt(result(8+i)),limit=estimate+estimate/10n;return {operation:'publish',bodyUtf8Bytes:bytes,estimatedGas:String(estimate),gasLimit:String(limit),gasPriceWei:String(price),estimatedFeeWei:String(limit*price),kind:'RPC estimate, not a transaction receipt'};})};
fs.mkdirSync('deployment',{recursive:true});fs.mkdirSync('benchmarks',{recursive:true});fs.writeFileSync('deployment/testnet-audit.json',JSON.stringify(report,null,2));fs.writeFileSync('benchmarks/monad-estimates.json',JSON.stringify(report,null,2));
fs.mkdirSync('artifacts/verification-legacy',{recursive:true});
for(const [name,address,artifact,args] of [['DemoToken',config.token,t,''],['CreationHub',config.hub,h,AbiCoder.defaultAbiCoder().encode(['address'],[config.token]).slice(2)]])fs.writeFileSync(`artifacts/verification-legacy/${name}.json`,JSON.stringify({chainId:10143,contractAddress:address,contractName:`contracts/${name}.sol:${name}`,compilerVersion:'v'+solc.version().split('.Emscripten')[0],standardJsonInput:input,foundryMetadata:JSON.parse(artifact.metadata),constructorArgs:args}));
console.log(JSON.stringify(report,null,2));
