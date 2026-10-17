import fs from 'node:fs';
import {JsonRpcProvider,Contract,isAddress} from 'ethers';
import hubAbi from '../web/generated/CreationHub.json' with {type:'json'};
import tokenAbi from '../web/generated/DemoToken.json' with {type:'json'};
import {publicProvider} from './public-provider.mjs';
export async function validate(config){
 if(config.chainId!==10143||!/^https:\/\//.test(config.rpcUrl)||!isAddress(config.hub)||!isAddress(config.token))throw Error('Requires chain 10143, HTTPS RPC and both contract addresses');
 const p=publicProvider(config.rpcUrl);
 try{
  if((await p.getNetwork()).chainId!==10143n)throw Error('RPC chain mismatch');
  for(const a of [config.hub,config.token])if(await p.getCode(a)==='0x')throw Error('No deployed bytecode at '+a);
  const hub=new Contract(config.hub,hubAbi,p),t=new Contract(config.token,tokenAbi,p);
  if((await hub.token()).toLowerCase()!==config.token.toLowerCase())throw Error('Currency mismatch');
  if(await t.symbol()!=='BLITZ'||await t.decimals()!==18n)throw Error('Unexpected demo currency');
  await hub.creationCount();return config;
 }finally{p.destroy();}
}
if(process.argv[1]?.endsWith('configure-hub.mjs')){
 if(!process.argv[2])throw Error('Usage: npm run configure:hub -- path/to/config.json');
 const config=await validate(JSON.parse(fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'')));
 fs.writeFileSync('web/hub-deployment.json',JSON.stringify(config,null,2));console.log('Shared testnet configuration verified and saved. Rebuild before publishing.');
}
