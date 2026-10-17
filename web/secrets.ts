import {AbiCoder,keccak256,getAddress} from 'ethers';
export type Secret={price:string;salt:string;commitment:string};
export function validateSalt(salt:string){
  if(Array.from(salt).length!==18)throw Error('salt 必须恰好为 18 个 Unicode 字符');
  for(const c of salt){const cp=c.codePointAt(0)!;if(cp>=0xd800 && cp<=0xdfff)throw Error('salt 包含无效 Unicode 字符');}
}
export function priceHash(price:bigint,address:string,salt:string){validateSalt(salt);return keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','string'],[price,getAddress(address),salt]));}
export function newSalt(){const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*?';const bytes=new Uint8Array(18);crypto.getRandomValues(bytes);return Array.from(bytes,b=>alphabet[b%alphabet.length]).join('');}
export function secretKey(chain:number,contract:string,auction:string,account:string,round:string){return `aureum:${chain}:${contract.toLowerCase()}:${auction}:${account.toLowerCase()}:${round}`;}
export function saveSecret(key:string,value:Secret){localStorage.setItem(key,JSON.stringify(value));}
export function loadSecret(key:string):Secret|null{try{return JSON.parse(localStorage.getItem(key)??'null')}catch{return null}}
export function downloadSecret(key:string,value:Secret){const url=URL.createObjectURL(new Blob([JSON.stringify({key,...value},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='aureum-reveal-backup.json';a.click();URL.revokeObjectURL(url);}
