import fs from 'node:fs';
import solc from 'solc';
import {AbiCoder} from 'ethers';
import {validate} from './configure-hub.mjs';
import {compile} from './compile.mjs';
const config=await validate(JSON.parse(fs.readFileSync('web/hub-deployment.json','utf8')));
compile();
const standardJsonInput=JSON.parse(fs.readFileSync('artifacts/standard-input.json'));
for(const [name,address,args] of [['DemoToken',config.token,''],['CreationHub',config.hub,AbiCoder.defaultAbiCoder().encode(['address'],[config.token]).slice(2)]]){
 const a=JSON.parse(fs.readFileSync('artifacts/'+name+'.json'));
 const payload={chainId:10143,contractAddress:address,contractName:'contracts/'+name+'.sol:'+name,compilerVersion:'v'+solc.version().split('.Emscripten')[0],standardJsonInput,foundryMetadata:JSON.parse(a.metadata),constructorArgs:args};
 const response=await fetch('https://agents.devnads.com/v1/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
 const body=await response.text();fs.mkdirSync('verification',{recursive:true});fs.writeFileSync('verification/'+name+'.json',body);
 if(!response.ok)throw Error(name+' verification request failed: '+response.status+' '+body.slice(0,500));
 console.log(name+': verification request accepted; inspect verification/'+name+'.json and explorer for final verification status.');
}
