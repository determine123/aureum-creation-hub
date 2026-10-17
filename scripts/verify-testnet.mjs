import fs from 'node:fs';
import {AbiCoder,JsonRpcProvider,getAddress,Contract} from 'ethers';
import solc from 'solc';
import {compile} from './compile.mjs';
const file=process.argv[2];
if(!file)throw Error('Usage: npm run verify:testnet -- ./deployment-testnet.json (export from app network settings)');
const config=JSON.parse(fs.readFileSync(file,'utf8'));
if(config.chainId!==10143)throw Error('Verification is restricted to Monad testnet 10143');
compile();
const provider=new JsonRpcProvider(config.rpcUrl);
try{
  if((await provider.getNetwork()).chainId!==10143n)throw Error('RPC network mismatch');
  const token=getAddress(config.token),auction=getAddress(config.auction);
  const abi=JSON.parse(fs.readFileSync('web/generated/BlindAuction.json','utf8'));
  if(getAddress(await new Contract(auction,abi,provider).token())!==token)throw Error('Auction currency mismatch');
  for(const [name,address,args] of [['DemoToken',token,''],['BlindAuction',auction,AbiCoder.defaultAbiCoder().encode(['address'],[token]).slice(2)]]){
    if(await provider.getCode(address)==='0x')throw Error(`No code at ${address}`);
    const artifact=JSON.parse(fs.readFileSync(`artifacts/${name}.json`,'utf8'));
    const request={chainId:10143,contractAddress:address,contractName:`contracts/${name}.sol:${name}`,compilerVersion:'v'+solc.version().split('.Emscripten')[0],standardJsonInput:JSON.parse(fs.readFileSync('artifacts/standard-input.json','utf8')),foundryMetadata:JSON.parse(artifact.metadata),...(args?{constructorArgs:args}:{})};
    fs.writeFileSync(`artifacts/verify-${name}.json`,JSON.stringify(request,null,2));
    const response=await fetch('https://agents.devnads.com/v1/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(60000)});
    const result=await response.text();console.log(`${name}: HTTP ${response.status}\n${result}`);
    if(!response.ok)throw Error('Verification API failed; request retained in artifacts for retry.');
  }
}finally{provider.destroy();}
