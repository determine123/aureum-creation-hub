import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,AbiCoder,keccak256,parseEther} from 'ethers';
import {compile} from '../scripts/compile.mjs';
const compiled=compile();
const artifact=name=>compiled.contracts[`contracts/${name}.sol`][name];
const U=parseEther, D=U('100000');
const hash=(p,a,s)=>keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','string'],[p,a,s]));
const salt=n=>`salt-${String(n).padStart(13,'0')}`;
async function fixture(accounts=7){
  const rpc=ganache.provider({wallet:{totalAccounts:accounts},logging:{quiet:true},chain:{hardfork:'shanghai'}});
  const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
  const signers=await Promise.all(Array.from({length:accounts},(_,i)=>provider.getSigner(i)));
  const addresses=await Promise.all(signers.map(s=>s.getAddress()));
  async function deploy(name,args=[]){const a=artifact(name);const c=await new ContractFactory(a.abi,a.evm.bytecode.object,signers[0]).deploy(...args);await c.waitForDeployment();return c;}
  const token=await deploy('DemoToken');const auction=await deploy('BlindAuction',[await token.getAddress()]);
  const tx=async p=>(await p).wait();
  for(const s of signers){await tx(token.connect(s).faucet());await tx(token.connect(s).approve(await auction.getAddress(),D));}
  async function jump(seconds){await rpc.request({method:'evm_increaseTime',params:[seconds]});await rpc.request({method:'evm_mine',params:[]});}
  async function at(timestamp){const block=await rpc.request({method:'eth_getBlockByNumber',params:['latest',false]});await jump(Number(timestamp)-Number(BigInt(block.timestamp)));}
  async function create(actual=U('500'),ceiling=U('1000'),s=salt(0)) {await tx(auction.createAuction('Test auction',ceiling,hash(actual,addresses[0],s)));return Number(await auction.auctionCount());}
  async function join(id,indices=[1,2,3]){for(const i of indices)await tx(auction.connect(signers[i]).join(id));}
  async function commitReveal(id,prices,indices=[1,2,3],reverse=false){
    const a=await auction.getAuction(id);await at(a.roundStart);
    for(let j=0;j<indices.length;j++){const i=indices[j];await tx(auction.connect(signers[i]).commitBid(id,hash(prices[j],addresses[i],salt(Number(a.round)*100+i))));}
    await at(a.roundStart+30n);
    for(const j of (reverse?prices.map((_,i)=>i).reverse():prices.map((_,i)=>i))){const i=indices[j];await tx(auction.connect(signers[i]).revealBid(id,prices[j],salt(Number(a.round)*100+i)));}
    await at(a.roundStart+60n);
  }
  return {rpc,provider,signers,addresses,token,auction,tx,jump,at,create,join,commitReveal,close:()=>rpc.disconnect()};
}
async function scenario(run,n){const f=await fixture(n);try{await run(f)}finally{await f.close()}}

test('registration, lazy start and exact commit/reveal boundaries',()=>scenario(async f=>{
  const {auction:a,signers:s,addresses,tx}=f;const id=await f.create();
  assert.equal(await a.getPhase(id),0n);
  await assert.rejects(a.join(id));
  await f.join(id,[1,2]);assert.equal(await a.getPhase(id),0n);
  await f.join(id,[3]);assert.equal(await a.getPhase(id),1n);
  await assert.rejects(a.connect(s[1]).join(id));
  const start=(await a.getAuction(id)).roundStart;
  await f.at(start-1n);await assert.rejects(a.connect(s[1]).commitBid(id,hash(100,addresses[1],salt(1))));
  await f.at(start);assert.equal(await a.getPhase(id),2n);
  await assert.rejects(a.connect(s[4]).join(id));await assert.rejects(a.connect(s[4]).commitBid(id,hash(100,addresses[4],salt(4))));
  await tx(a.connect(s[1]).commitBid(id,hash(100,addresses[1],salt(1))));
  await assert.rejects(a.connect(s[1]).commitBid(id,hash(100,addresses[1],salt(1))));
  await assert.rejects(a.connect(s[1]).revealBid(id,100,salt(1)));
  await f.at(start+30n);assert.equal(await a.getPhase(id),3n);
  await assert.rejects(a.connect(s[2]).commitBid(id,hash(100,addresses[2],salt(2))));
  await assert.rejects(a.connect(s[1]).revealBid(id,101,salt(1)));
  await tx(a.connect(s[1]).revealBid(id,100,salt(1)));
  await assert.rejects(a.compare(id));
  await f.at(start+60n);assert.equal(await a.getPhase(id),4n);
  await assert.rejects(a.connect(s[1]).revealBid(id,100,salt(1)));
  await tx(a.connect(s[6]).compare(id));assert.equal((await a.getAuction(id)).round,2n);
}));

test('early sale and both directions of difference settlement conserve escrow',()=>scenario(async f=>{
  for(const actual of [U('500'),U('100')]){
    const id=await f.create(actual);await f.join(id);
    const before=await Promise.all(f.addresses.slice(0,4).map(a=>f.token.balanceOf(a)));
    await f.commitReveal(id,[U('300'),U('100'),U('50')]);
    await f.tx(f.auction.connect(f.signers[6]).compare(id));
    assert.equal(await f.auction.getPhase(id),5n);
    await assert.rejects(f.auction.connect(f.signers[1]).revealSeller(id,actual,salt(0)));
    await f.tx(f.auction.revealSeller(id,actual,salt(0)));
    assert.equal(await f.auction.getPhase(id),6n);
    const d=U('300')-actual;
    assert.equal(await f.token.balanceOf(f.addresses[0]),before[0]+D+d);
    assert.equal(await f.token.balanceOf(f.addresses[1]),before[1]+D-d);
    assert.equal(await f.token.balanceOf(f.addresses[2]),before[2]+D);
    assert.equal(await f.token.balanceOf(await f.auction.getAddress()),0n);
    await f.tx(f.auction.refundFor(id,f.addresses[1]));assert.equal(await f.auction.claimable(id,f.addresses[1]),0n);
    // Replenish approvals for the next independent auction.
    for(const signer of f.signers.slice(0,4)){await f.tx(f.token.connect(signer).faucet());await f.tx(f.token.connect(signer).approve(await f.auction.getAddress(),D));}
  }
}));

test('five rounds, strict 2x threshold and registration-order ties',()=>scenario(async f=>{
  const id=await f.create();await f.join(id);
  for(let r=1;r<=5;r++){
    const values=r===1?[U('100'),U('50'),U('50')]:[U(String(r*100)),U(String(r*100)),U(String(r*90))];
    await f.commitReveal(id,values,[1,2,3],true);
    await f.tx(f.auction.compare(id));
    assert.equal(await f.auction.getPhase(id),r===5?5n:2n);
  }
  const a=await f.auction.getAuction(id);assert.equal(a.winner,f.addresses[1]);assert.equal(a.winningBid,U('500'));
  await f.tx(f.auction.revealSeller(id,U('500'),salt(0)));assert.equal(await f.token.balanceOf(await f.auction.getAddress()),0n);
}));

test('ceiling, monotonic bids, reused commitments and missed-round exclusion',()=>scenario(async f=>{
  const id=await f.create();await f.join(id);await f.commitReveal(id,[U('100'),U('90')],[1,2]);
  await f.tx(f.auction.compare(id));
  await assert.rejects(f.auction.connect(f.signers[3]).commitBid(id,hash(U('100'),f.addresses[3],salt(3))));
  await assert.rejects(f.auction.connect(f.signers[1]).commitBid(id,hash(U('100'),f.addresses[1],salt(101))));
  await f.tx(f.auction.connect(f.signers[1]).commitBid(id,hash(U('99'),f.addresses[1],salt(201))));
  await f.tx(f.auction.connect(f.signers[2]).commitBid(id,hash(U('1001'),f.addresses[2],salt(202))));
  const start=(await f.auction.getAuction(id)).roundStart;await f.at(start+30n);
  await assert.rejects(f.auction.connect(f.signers[1]).revealBid(id,U('99'),salt(201)));
  await assert.rejects(f.auction.connect(f.signers[2]).revealBid(id,U('1001'),salt(202)));
  await f.at(start+60n);await f.tx(f.auction.compare(id));
  assert.equal(await f.auction.getPhase(id),7n);assert.equal(await f.token.balanceOf(await f.auction.getAddress()),0n);
}));

test('seller timeout, invalid seller price and outsider finalization',()=>scenario(async f=>{
  const id=await f.create(U('1001'));await f.join(id);await f.commitReveal(id,[U('300'),U('100'),U('50')]);
  await f.tx(f.auction.compare(id));
  await assert.rejects(f.auction.revealSeller(id,U('1001'),salt(0)));
  await assert.rejects(f.auction.finalizeSellerTimeout(id));
  await f.at((await f.auction.getAuction(id)).sellerDeadline);
  await assert.rejects(f.auction.revealSeller(id,U('500'),salt(0)));
  const before=await f.token.balanceOf(f.addresses[1]);
  await f.tx(f.auction.connect(f.signers[6]).finalizeSellerTimeout(id));
  assert.equal(await f.token.balanceOf(f.addresses[1]),before+2n*D);
  assert.equal(await f.token.balanceOf(f.addresses[0]),0n);
  assert.equal(await f.token.balanceOf(await f.auction.getAddress()),0n);
}));

test('unfilled lobby cancellation and expiry release every deposit',()=>scenario(async f=>{
  const id=await f.create();await f.join(id,[1,2]);
  await assert.rejects(f.auction.connect(f.signers[3]).cancelLobby(id));
  await f.jump(86400);await assert.rejects(f.auction.connect(f.signers[3]).join(id));
  await f.tx(f.auction.connect(f.signers[3]).cancelLobby(id));
  assert.equal(await f.auction.getPhase(id),7n);assert.equal(await f.token.balanceOf(await f.auction.getAddress()),0n);
}));

test('maximum collateral still covers either direction of the full settlement range',()=>scenario(async f=>{
  for(const [actual,winning,other] of [[0n,D,1n],[D,3n,1n]]){
    const id=await f.create(actual,D);await f.join(id);
    await f.commitReveal(id,[winning,other,0n]);await f.tx(f.auction.compare(id));
    const before=await Promise.all(f.addresses.slice(0,2).map(a=>f.token.balanceOf(a)));
    await f.tx(f.auction.revealSeller(id,actual,salt(0)));
    assert.equal(await f.token.balanceOf(f.addresses[0]),before[0]+D+winning-actual);
    assert.equal(await f.token.balanceOf(f.addresses[1]),before[1]+D+actual-winning);
    assert.equal(await f.token.balanceOf(await f.auction.getAddress()),0n);
    for(const signer of f.signers.slice(0,4)){await f.tx(f.token.connect(signer).faucet());await f.tx(f.token.connect(signer).approve(await f.auction.getAddress(),D));}
  }
}));

test('unlimited entrants use bounded refunds and permissionless claims',()=>scenario(async f=>{
  const id=await f.create();await f.join(id,Array.from({length:23},(_,i)=>i+1));
  assert.equal(await f.auction.buyerCount(id),23n);
  assert.equal((await f.auction.getBuyers(id,20,100)).length,3);
  await f.at((await f.auction.getAuction(id)).roundStart+60n);
  await f.tx(f.auction.compare(id)); // no reveals: cancel, first 20 automatically refunded
  assert.equal((await f.auction.getAuction(id)).refundCursor,20n);
  assert.equal(await f.token.balanceOf(await f.auction.getAddress()),4n*D);
  await f.tx(f.auction.refundFor(id,f.addresses[23]));
  await assert.rejects(f.auction.refundBatch(id,51));
  await f.tx(f.auction.connect(f.signers[24]).refundBatch(id,50));
  assert.equal(await f.token.balanceOf(await f.auction.getAddress()),0n);
  for(const account of f.addresses.slice(0,24))assert.equal(await f.auction.claimable(id,account),0n);
},25));
