import fs from 'node:fs';
import {validate} from './configure-hub.mjs';
const manifest=JSON.parse(fs.readFileSync('submission/project.json','utf8'));
const checks=[];
const add=(name,ok,detail='')=>checks.push({name,status:ok?'pass':'blocked',detail});
add('project-name',Boolean(manifest.projectName?.trim()));
add('event',manifest.eventId===17&&manifest.eventName==='Monad Blitz');
for(const [field,pattern] of [['frontendUrl',/^https:\/\//],['githubUrl',/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/]]){
 const value=manifest[field]||'';
 add(field,pattern.test(value),value||'Missing public URL');
 if(pattern.test(value))try{
  const response=await fetch(value,{redirect:'follow',signal:AbortSignal.timeout(15000)});
  const finalURL=new URL(response.url);
  const body=await response.text();
  const login=field==='githubUrl'&&finalURL.pathname.startsWith('/login');
  const signIn=field==='frontendUrl'&&(/\/(auth|login|signin)(\/|$)/i.test(finalURL.pathname)||/sign in to (chatgpt|continue)|log in to (chatgpt|continue)/i.test(body.slice(0,12000)));
  add(field+'-anonymous-http',response.ok&&!login&&!signIn,`${response.status} ${response.url}; browser acceptance still required`);
 }catch(e){add(field+'-anonymous-http',false,e.message);}
}
const screenshots=manifest.screenshots||[];
add('screenshot-count',screenshots.length>=1&&screenshots.length<=5);
for(const path of screenshots)try{
 const png=fs.readFileSync(path);
 if(png.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('Expected PNG');
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 add(path,width>height,`${width}×${height}`);
}catch(e){add(path,false,e.message);}
for(const path of ['README.md',manifest.documentation,'.monskills'])add(path,fs.existsSync(path));
try{
 const config=JSON.parse(fs.readFileSync('web/hub-deployment.json','utf8'));
 if(config.chainId!==10143)throw Error('Local demonstration config is not eligible for public submission');
 await validate(config);add('testnet-contracts',true);
}catch(e){add('testnet-contracts',false,e.message);}
add('explorer-verification-records',fs.existsSync('verification/DemoToken.json')&&fs.existsSync('verification/CreationHub.json'),'Records must also be inspected for final verification success');
let officialRead=false;try{const record=JSON.parse(fs.readFileSync('submission/agent-instructions-record.json','utf8'));officialRead=record.source==='https://mojo.devnads.com/api/agent/instructions/17/skill.md'&&/^[a-f0-9]{64}$/.test(record.sha256);}catch{}
add('agent-instructions-read',officialRead,'Source and SHA-256 recorded after reading the official instructions');
fs.writeFileSync('submission/readiness.json',JSON.stringify({ready:checks.every(c=>c.status==='pass'),checks},null,2));
for(const c of checks)console.log(`${c.status.toUpperCase()} ${c.name}${c.detail?' — '+c.detail:''}`);
if(checks.some(c=>c.status!=='pass'))process.exitCode=1;
