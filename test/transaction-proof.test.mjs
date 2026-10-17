import test from 'node:test';
import assert from 'node:assert/strict';
import {Interface} from 'ethers';
import abi from '../web/generated/CreationHub.json' with {type:'json'};
import {transactionProof} from '../scripts/transaction-proof.mjs';
const iface=new Interface(abi),author='0x'+'11'.repeat(20),hub='0x'+'22'.repeat(20),token='0x'+'33'.repeat(20),hash='0x'+'ab'.repeat(32),blockHash='0x'+'cd'.repeat(32);
function fixture(method='publish',args=['Title','Summary','Body','',0]){
 const log=iface.encodeEventLog(iface.getEvent('Published'),[0n,author,0]);
 return {config:{hub,token},chainId:10143n,tx:{hash,to:hub,from:author,chainId:10143n,blockHash,data:iface.encodeFunctionData(method,args),value:0n,gasLimit:100000n},receipt:{hash,to:hub,blockHash,blockNumber:10,status:1,gasUsed:90000n,gasPrice:2n,logs:[{address:hub,...log}]},block:{hash:blockHash,number:10,timestamp:1700000000},finalized:{number:12}};
}
test('finalized publication proof charges gas limit and never invents confirmation latency',()=>{
 const r=transactionProof(fixture());assert.equal(r.method,'publish');assert.equal(r.chargedFeeWei,'200000');assert.equal(r.confirmationLatencyMs,null);assert.equal(r.kind,'finalized_transaction_receipt');
});
test('reject wrong networks, failed receipts, other contracts, orphan blocks and unmatched events',()=>{
 for(const mutate of [f=>f.chainId=31337n,f=>f.tx.chainId=31337n,f=>f.receipt.status=0,f=>f.tx.to=token,f=>f.receipt.hash=blockHash,f=>f.block.hash=hash,f=>f.finalized.number=9,f=>f.receipt.logs=[],f=>f.receipt.logs[0].address=token]){const f=fixture();mutate(f);assert.throws(()=>transactionProof(f));}
 assert.throws(()=>transactionProof(fixture('setSaved',[0n,true])));
});
test('batch proof validates each support amount against signed input',()=>{
 const f=fixture('supportBatch',[[0n,1n],[2n,3n]]);
 f.receipt.logs=[0n,1n].map((id,i)=>({address:hub,...iface.encodeEventLog(iface.getEvent('Supported'),[id,author,BigInt(i+2)])}));
 assert.equal(transactionProof(f).supportedItems,2);
 f.receipt.logs[1]={address:hub,...iface.encodeEventLog(iface.getEvent('Supported'),[1n,author,999n])};assert.throws(()=>transactionProof(f));
});
test('single support requires its own matching event and amount',()=>{
 const f=fixture('support',[2n,30n]);f.receipt.logs=[{address:hub,...iface.encodeEventLog(iface.getEvent('Supported'),[2n,author,30n])}];
 assert.equal(transactionProof(f).supportedItems,1);
 f.receipt.logs=[{address:hub,...iface.encodeEventLog(iface.getEvent('Supported'),[2n,author,31n])}];assert.throws(()=>transactionProof(f));
});
