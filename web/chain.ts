import {BrowserProvider,Contract,JsonRpcProvider,formatEther,getAddress,parseEther,type ContractTransactionResponse,type JsonRpcSigner} from 'ethers';
import auctionAbi from './generated/BlindAuction.json';
import tokenAbi from './generated/DemoToken.json';
import initial from './deployment.json';
import testnetDeployment from './testnet-deployment.json';
export const DEPOSIT=parseEther('100000');
export const PHASES=['等待报名','即将开始','密封报价','报价揭露','等待比价','卖方揭露','已结算','已取消'];
export type Config={chainId:number;rpcUrl:string;token:string;auction:string};
export type Auction={id:number;seller:string;title:string;ceiling:bigint;sellerCommitment:string;createdAt:number;roundStart:number;sellerDeadline:number;round:number;status:number;winner:string;winningBid:bigint;actualPrice:bigint;sellerDefaulted:boolean;refundCursor:number;count:number;phase:number;};
export type Player={address:string;index:number;lastPrice:bigint;revealedRounds:number;commitment:string;price:bigint;revealed:boolean;refunded:boolean};
export const short=(a:string)=>a?`${a.slice(0,6)}…${a.slice(-4)}`:'—';
export const amount=(n:bigint)=>Number(formatEther(n)).toLocaleString('en-US',{maximumFractionDigits:4});
export function defaultConfig():Config{return ['localhost','127.0.0.1'].includes(location.hostname)&&import.meta.env.VITE_USE_TESTNET!=='true'?initial:{chainId:10143,rpcUrl:import.meta.env.VITE_RPC_URL||testnetDeployment.rpcUrl,token:import.meta.env.VITE_TOKEN_ADDRESS||testnetDeployment.token,auction:import.meta.env.VITE_CONTRACT_ADDRESS||testnetDeployment.auction};}
export function readConfig():Config{try{const x=JSON.parse(localStorage.getItem('aureum:config')??'null');return x??defaultConfig()}catch{return defaultConfig()}}
export function saveConfig(c:Config){localStorage.setItem('aureum:config',JSON.stringify(c));}
export function createClient(c:Config){const provider=new JsonRpcProvider(c.rpcUrl,c.chainId,{staticNetwork:true,cacheTimeout:500});if(c.chainId===31337)provider.pollingInterval=250;return provider;}
export function auctionContract(c:Config,p:JsonRpcProvider|JsonRpcSigner){return new Contract(c.auction,auctionAbi,p);}
export function tokenContract(c:Config,p:JsonRpcProvider|JsonRpcSigner){return new Contract(c.token,tokenAbi,p);}
export async function getAuction(c:Config,p:JsonRpcProvider,id:number):Promise<Auction>{
  const a=auctionContract(c,p);const [v,n,phase]=await Promise.all([a.getAuction(id),a.buyerCount(id),a.getPhase(id)]);
  return {id,seller:v.seller,title:v.title,ceiling:v.ceiling,sellerCommitment:v.sellerCommitment,createdAt:Number(v.createdAt),roundStart:Number(v.roundStart),sellerDeadline:Number(v.sellerDeadline),round:Number(v.round),status:Number(v.status),winner:v.winner,winningBid:v.winningBid,actualPrice:v.actualPrice,sellerDefaulted:v.sellerDefaulted,refundCursor:Number(v.refundCursor),count:Number(n),phase:Number(phase)};
}
export async function getPlayers(c:Config,p:JsonRpcProvider,a:Auction,page:number):Promise<Player[]>{
  const contract=auctionContract(c,p);const addresses:string[]=await contract.getBuyers(a.id,page*16,16);
  return Promise.all(addresses.map(async(address)=>{const [v,b,refunded]=await Promise.all([contract.players(a.id,address),contract.bids(a.id,a.round,address),contract.refunded(a.id,address)]);return {address,index:Number(v.index),lastPrice:v.lastPrice,revealedRounds:Number(v.revealedRounds),commitment:b.commitment,price:b.price,revealed:b.revealed,refunded};}));
}
export async function send(contract:Contract,method:string,args:unknown[]=[]):Promise<ContractTransactionResponse>{
  const fn=contract.getFunction(method);const gas=await fn.estimateGas(...args);return fn(...args,{gasLimit:gas+gas/10n});
}
export function parsePrice(s:string){if(!/^\d+(\.\d{1,18})?$/.test(s))throw Error('请输入非负数字，最多 18 位小数');return parseEther(s);}
export function errorText(error:unknown){const e=error as {shortMessage?:string;reason?:string;message?:string;code?:string;revert?:{name?:string}};if(e.code==='ACTION_REJECTED')return '你已取消钱包签名';const name=e.revert?.name;const errors:Record<string,string>={WrongPhase:'当前阶段不允许此操作，请刷新链上状态',InvalidAmount:'价格必须在限价内，并且不低于上一轮',InvalidSalt:'salt 必须恰好为 18 个 Unicode 字符',InvalidCommitment:'价格、地址或 salt 与提交的 hash 不一致，或重复使用了 hash',NotParticipant:'未报名或上一轮未完成揭露',AlreadyDone:'你已完成此操作',InsufficientAllowance:'请先授权保证金',ERC20InsufficientBalance:'测试代币余额不足，请先领取',InvalidTitle:'标题不能为空，且 UTF-8 长度不能超过 120 字节'};return errors[name??'']??e.reason??e.shortMessage??e.message??String(error);}
export async function injected(c:Config,selectedProvider?:{request:(x:{method:string;params?:unknown[]})=>Promise<unknown>}){
  const ethereum=selectedProvider??(window as unknown as {ethereum?:{request:(x:{method:string;params?:unknown[]})=>Promise<unknown>}}).ethereum;
  if(!ethereum)throw Error('当前浏览器未发现钱包扩展。请在当前 Edge/Chrome 配置文件启用 MetaMask/Rabby、允许访问此网站并解锁，然后刷新页面。Codex 内置浏览器请改用外部浏览器。');
  await ethereum.request({method:'eth_requestAccounts'});
  const chainId='0x'+c.chainId.toString(16);
  try{await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}catch(e){
    if((e as {code:number}).code!==4902)throw e;
    await ethereum.request({method:'wallet_addEthereumChain',params:[{chainId,chainName:c.chainId===10143?'Monad Testnet':'Aureum Local',nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:[c.rpcUrl],...(c.chainId===10143?{blockExplorerUrls:['https://testnet.monadscan.com']}: {})}]});
  }
  const provider=new BrowserProvider(ethereum);
  if((await provider.getNetwork()).chainId!==BigInt(c.chainId))throw Error('钱包网络不匹配');
  return provider.getSigner();
}
export function validateAddress(s:string){return getAddress(s);}
