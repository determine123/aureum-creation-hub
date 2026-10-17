import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
export function compile() {
  const sources = Object.fromEntries(fs.readdirSync('contracts').filter(f=>f.endsWith('.sol')).map(f=>[`contracts/${f}`,{content:fs.readFileSync(`contracts/${f}`,'utf8')}]));
  const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','metadata']}}}};
  const dependencies={};
  const out=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{try{const contents=fs.readFileSync(path.join('node_modules',p),'utf8');dependencies[p]={content:contents};return {contents}}catch{return {error:`Missing ${p}`}}}}));
  for(const e of out.errors??[]) { if(e.severity==='error') throw Error(e.formattedMessage); else console.warn(e.formattedMessage); }
  fs.mkdirSync('artifacts',{recursive:true}); fs.mkdirSync('web/generated',{recursive:true});
  fs.writeFileSync('artifacts/standard-input.json',JSON.stringify({...input,sources:{...input.sources,...dependencies}},null,2));
  const deployArtifacts={};
  for(const [file,contracts] of Object.entries(out.contracts)) for(const [name,c] of Object.entries(contracts)) if(file.startsWith('contracts/')) {
    fs.writeFileSync(`artifacts/${name}.json`,JSON.stringify(c,null,2));
    fs.writeFileSync(`web/generated/${name}.json`,JSON.stringify(c.abi,null,2));
    if(['BlindAuction','DemoToken','MarketAsset','TokenMarket','CreationHub'].includes(name))deployArtifacts[name]={abi:c.abi,bytecode:'0x'+c.evm.bytecode.object};
  }
  fs.writeFileSync('web/generated/deploy.json',JSON.stringify(deployArtifacts));
  return out;
}
if(process.argv[1]?.endsWith('compile.mjs')){compile();console.log('Solidity compiled; ABI generated.');}
