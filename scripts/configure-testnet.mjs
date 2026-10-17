import fs from 'node:fs';
import {Contract,JsonRpcProvider,getAddress} from 'ethers';
const file=process.argv[2];
if(!file)throw Error('Usage: npm run configure:testnet -- ./deployment-testnet.json');
const input=JSON.parse(fs.readFileSync(file,'utf8'));
if(input.chainId!==10143)throw Error('Only Monad testnet 10143 is permitted');
const config={chainId:10143,rpcUrl:input.rpcUrl||'https://testnet-rpc.monad.xyz',token:getAddress(input.token),auction:getAddress(input.auction)};
if(new URL(config.rpcUrl).protocol!=='https:')throw Error('Public RPC must use HTTPS');
const p=new JsonRpcProvider(config.rpcUrl);
try{
  if((await p.getNetwork()).chainId!==10143n)throw Error('RPC chain mismatch');
  for(const address of [config.token,config.auction])if(await p.getCode(address)==='0x')throw Error(`No contract code at ${address}`);
  const a=new Contract(config.auction,JSON.parse(fs.readFileSync('web/generated/BlindAuction.json','utf8')),p);
  if(getAddress(await a.token())!==config.token)throw Error('Auction/token mismatch');
  if(await a.DEPOSIT()!==100000n*10n**18n)throw Error('Unexpected auction deposit');
  const t=new Contract(config.token,JSON.parse(fs.readFileSync('web/generated/DemoToken.json','utf8')),p);
  if(await t.symbol()!=='BLITZ'||await t.decimals()!==18n)throw Error('Unexpected test currency');
  fs.writeFileSync('web/testnet-deployment.json',JSON.stringify(config,null,2)+'\n');
  console.log('Verified shared testnet configuration saved. Rebuild and republish to share these contracts with every visitor.');
}finally{p.destroy();}
