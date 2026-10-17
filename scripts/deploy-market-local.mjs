import fs from 'node:fs';
import {JsonRpcProvider,ContractFactory} from 'ethers';
import {compile} from './compile.mjs';
compile();
const rpcUrl='http://127.0.0.1:8545',p=new JsonRpcProvider(rpcUrl);
if((await p.getNetwork()).chainId!==31337n)throw Error('Requires local chain 31337');
const s=await p.getSigner(0);
async function deploy(name,args=[]){const a=JSON.parse(fs.readFileSync('artifacts/'+name+'.json'));const f=new ContractFactory(a.abi,a.evm.bytecode.object,s);const gas=await s.estimateGas(await f.getDeployTransaction(...args));const c=await f.deploy(...args,{gasLimit:gas+gas/10n});await c.waitForDeployment();return c.getAddress();}
const asset=await deploy('MarketAsset'),currency=await deploy('DemoToken'),market=await deploy('TokenMarket',[asset,currency]);
const config={chainId:31337,rpcUrl,asset,currency,market};
fs.writeFileSync('web/market-deployment.json',JSON.stringify(config,null,2));console.log(config);
