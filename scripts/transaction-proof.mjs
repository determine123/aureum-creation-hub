import {Interface,formatEther} from 'ethers';
import abi from '../web/generated/CreationHub.json' with {type:'json'};
const iface=new Interface(abi);
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
/** Validate RPC-derived objects. Pure function for rejection and fee-accounting tests. */
export function transactionProof({config,chainId,tx,receipt,block,finalized}){
 if(chainId!==10143n||BigInt(tx?.chainId??0)!==10143n)throw Error('Not Monad testnet');
 if(!tx||!receipt||receipt.status!==1)throw Error('Missing or failed transaction');
 if(!same(tx.to,config.hub)||!same(receipt.to,config.hub))throw Error('Transaction targets another contract');
 if(!same(tx.hash,receipt.hash)||!same(tx.blockHash,receipt.blockHash)||!same(block?.hash,receipt.blockHash)||block.number!==receipt.blockNumber||!finalized||finalized.number<receipt.blockNumber)throw Error('Receipt is not canonical and finalized');
 const call=iface.parseTransaction({data:tx.data,value:tx.value});
 if(!call||!['publish','support','supportBatch'].includes(call.name))throw Error('Not a publish or support transaction');
 const events=receipt.logs.filter(l=>same(l.address,config.hub)).map(l=>{try{return iface.parseLog(l);}catch{return null;}}).filter(Boolean);
 const relevant=events.filter(e=>e.name===(call.name==='publish'?'Published':'Supported'));
 if(!relevant.length||relevant.some(e=>!same(e.args[1],tx.from)))throw Error('Missing matching author/supporter events');
 if(call.name==='publish'&&relevant.length!==1)throw Error('Unexpected publish events');
 if(call.name==='support'&&(relevant.length!==1||relevant[0].args.id!==call.args[0]||relevant[0].args.amount!==call.args[1]))throw Error('Support events do not match transaction input');
 if(call.name==='supportBatch'){
  const [ids,amounts]=call.args;
  if(ids.length!==relevant.length||ids.length!==amounts.length||ids.length===0||ids.length>20)throw Error('Batch event count mismatch');
  for(let i=0;i<ids.length;i++)if(relevant[i].args.id!==ids[i]||relevant[i].args.amount!==amounts[i])throw Error('Batch events do not match transaction input');
 }
 const fee=tx.gasLimit*receipt.gasPrice;
 return {kind:'finalized_transaction_receipt',recordedAt:new Date().toISOString(),chainId:10143,hub:config.hub,token:config.token,hash:tx.hash,from:tx.from,method:call.name,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,blockTimestamp:block.timestamp,finalizedAtLeastBlock:finalized.number,gasLimit:String(tx.gasLimit),gasUsed:String(receipt.gasUsed),effectiveGasPriceWei:String(receipt.gasPrice),chargedFeeWei:String(fee),chargedFeeMon:formatEther(fee),confirmationLatencyMs:null,latencyNote:'Imported after mining; original submission-to-confirmation latency is unknown',supportedItems:call.name==='publish'?0:relevant.length};
}
