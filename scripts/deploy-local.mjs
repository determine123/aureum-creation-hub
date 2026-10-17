import fs from 'node:fs';
import {JsonRpcProvider,ContractFactory} from 'ethers';
import {compile} from './compile.mjs';
compile();
const provider=new JsonRpcProvider('http://127.0.0.1:8545');
if((await provider.getNetwork()).chainId!==31337n)throw Error('Local deployment requires chain 31337');
const signer=await provider.getSigner(0);
async function deploy(name,args=[]){const c=JSON.parse(fs.readFileSync(`artifacts/${name}.json`));const contract=await new ContractFactory(c.abi,c.evm.bytecode.object,signer).deploy(...args);await contract.waitForDeployment();console.log(`${name}: ${await contract.getAddress()}`);return contract;}
const token=await deploy('DemoToken');
const auction=await deploy('BlindAuction',[await token.getAddress()]);
const config={chainId:31337,rpcUrl:'http://127.0.0.1:8545',token:await token.getAddress(),auction:await auction.getAddress()};
fs.writeFileSync('web/deployment.json',JSON.stringify(config,null,2));
console.log('Local deployment saved to web/deployment.json');
