import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,parseEther as U} from 'ethers';
import {compile} from '../scripts/compile.mjs';
const output=compile();
test('public creation lifecycle, atomic support, bookmarks, author permissions and bounds',async()=>{
 const rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'}});
 const p=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});p.pollingInterval=10;
 try{
 const author=await p.getSigner(0),reader=await p.getSigner(1),a=await author.getAddress();
 async function deploy(name,args=[]){const c=output.contracts['contracts/'+name+'.sol'][name];const v=await new ContractFactory(c.abi,c.evm.bytecode.object,author).deploy(...args);await v.waitForDeployment();return v;}
 const t=await deploy('DemoToken'),h=await deploy('CreationHub',[await t.getAddress()]);
 const tx=async v=>(await v).wait();
 await assert.rejects(h.publish('','Summary','Body','',0));
 await assert.rejects(h.publish('Title','Summary','Body','',5));
 await assert.rejects(h.publish('中'.repeat(41),'Summary','Body','',0));
 await assert.rejects(h.publish('Title','Summary','x'.repeat(6001),'',0));
 await tx(h.publish('原创项目','项目摘要','正文支持中文与 Emoji 🚀','https://example.com',0));
 assert.equal(await h.creationCount(),1n);assert.equal((await h.getCreation(0)).author,a);
 await assert.rejects(h.listCreations(0,21));assert.equal((await h.listCreations(1,20)).length,0);
 await assert.rejects(h.support(0,U('10')));
 await tx(t.connect(reader).faucet());
 await assert.rejects(h.connect(reader).support(0,U('10')));
 assert.equal(await h.totalSupport(),0n);assert.equal((await h.getCreation(0)).support,0n);
 await tx(t.connect(reader).approve(await h.getAddress(),U('10')));
 await tx(h.connect(reader).support(0,U('10')));
 assert.equal(await t.balanceOf(a),U('10'));assert.equal(await t.balanceOf(await reader.getAddress()),U('99990'));
 assert.equal(await h.received(a),U('10'));assert.equal(await h.totalSupport(),U('10'));assert.equal(await t.balanceOf(await h.getAddress()),0n);
 await tx(h.connect(reader).setSaved(0,true));assert.equal((await h.getCreation(0)).saves,1n);
 await assert.rejects(h.connect(reader).setSaved(0,true));
 await tx(h.connect(reader).setSaved(0,false));assert.equal((await h.getCreation(0)).saves,0n);
 await assert.rejects(h.connect(reader).setArchived(0,true));
 await tx(h.setArchived(0,true));await assert.rejects(h.connect(reader).support(0,U('1')));
 assert.equal((await h.getCreation(0)).body,'正文支持中文与 Emoji 🚀');
 await tx(h.setArchived(0,false));assert.equal((await h.listCreations(0,20))[0].archived,false);
 // Batch: direct multi-author transfers and all-or-nothing rollback, including earlier transfers.
 const other=await p.getSigner(2),otherAddress=await other.getAddress();
 await tx(h.connect(other).publish('Second','Summary','Body','',1));
 const r=h.connect(reader);
 await tx(t.connect(reader).approve(await h.getAddress(),U('1000')));
 await assert.rejects(r.supportBatch([],[]));
 await assert.rejects(r.supportBatch([0],[U('1'),U('2')]));
 await assert.rejects(r.supportBatch(Array.from({length:21},(_,i)=>i),Array(21).fill(1n)));
 await assert.rejects(r.supportBatch([0,0],[U('1'),U('1')]));
 const balanceBefore=await t.balanceOf(a),totalBefore=await h.totalSupport();
 await assert.rejects(r.supportBatch([0,1],[U('5'),0n]));
 assert.equal(await t.balanceOf(a),balanceBefore);assert.equal(await h.totalSupport(),totalBefore);
 await tx(h.connect(other).setArchived(1,true));
 await assert.rejects(r.supportBatch([0,1],[U('5'),U('5')]));
 await tx(h.connect(other).setArchived(1,false));
 await assert.rejects(h.supportBatch([1,0],[U('1'),U('1')])); // Self support even after a valid item.
 await tx(t.connect(reader).approve(await h.getAddress(),U('6')));
 await assert.rejects(r.supportBatch([0,1],[U('5'),U('5')])); // Insufficient allowance on second item.
 assert.equal(await t.balanceOf(a),balanceBefore);assert.equal(await h.totalSupport(),totalBefore);
 await tx(t.connect(reader).approve(await h.getAddress(),U('10')));
 const receipt=await tx(r.supportBatch([0,1],[U('4'),U('6')]));
 assert.equal(await t.balanceOf(a),balanceBefore+U('4'));
 assert.equal(await t.balanceOf(otherAddress),U('6'));
 assert.equal(await h.totalSupport(),totalBefore+U('10'));
 assert.equal(await t.balanceOf(await h.getAddress()),0n);
 assert.equal(receipt.logs.filter(l=>{try{return h.interface.parseLog(l)?.name==='Supported';}catch{return false;}}).length,2);
 }finally{p.destroy();await rpc.disconnect();}
});
