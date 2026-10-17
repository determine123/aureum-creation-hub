import fs from 'node:fs';
import {publicProvider} from './public-provider.mjs';
import {transactionProof} from './transaction-proof.mjs';

const hash=process.argv[2];
if(!/^0x[a-fA-F0-9]{64}$/.test(hash||''))throw Error('Supply a complete real transaction hash. Truncated report hashes are not accepted.');
const config=JSON.parse(fs.readFileSync('web/hub-deployment.json','utf8'));
if(config.chainId!==10143||!config.rpcUrl.startsWith('https://'))throw Error('Requires public testnet configuration');
const p=publicProvider(config.rpcUrl);
try{
 const [network,tx,receipt,finalized]=await Promise.all([p.getNetwork(),p.getTransaction(hash),p.getTransactionReceipt(hash),p.getBlock('finalized')]);
 if(!receipt)throw Error('Transaction not mined');
 const block=await p.getBlock(receipt.blockNumber);
 const proof=transactionProof({config,chainId:network.chainId,tx,receipt,block,finalized});
 const path='benchmarks/monad-transactions.json';let records=[];
 if(fs.existsSync(path)){const previous=JSON.parse(fs.readFileSync(path,'utf8'));if(previous.chainId!==10143||!Array.isArray(previous.records))throw Error('Invalid existing evidence file');records=previous.records;}
 records=records.filter(r=>r.hash.toLowerCase()!==hash.toLowerCase());records.push(proof);
 fs.mkdirSync('benchmarks',{recursive:true});fs.writeFileSync(path,JSON.stringify({scope:'Actual finalized Monad receipts, not estimates or local EVM measurements',chainId:10143,records},null,2));
 const current=records.filter(r=>r.hub.toLowerCase()===config.hub.toLowerCase());
 const publish=current.find(r=>r.method==='publish'),support=current.find(r=>r.method==='supportBatch')??current.find(r=>r.method==='support');
 fs.mkdirSync('submission',{recursive:true});fs.writeFileSync('submission/public-e2e.json',JSON.stringify({passed:!!publish&&!!support,scope:'RPC receipt and event verification; does not replace browser or multi-wallet UX acceptance',chainId:10143,hub:config.hub,publishTx:publish?.hash??null,supportTx:support?.hash??null,supportMethod:support?.method??null},null,2));
 console.log(JSON.stringify(proof,null,2));
}finally{p.destroy();}
