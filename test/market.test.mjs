import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,parseEther as U} from 'ethers';
import {compile} from '../scripts/compile.mjs';
const out=compile();
test('market escrow, atomic purchase, permissions, cancellation and pagination',async()=>{
 const rpc=ganache.provider({logging:{quiet:true},chain:{hardfork:'shanghai'}});
 const provider=new BrowserProvider(rpc,undefined,{cacheTimeout:-1});provider.pollingInterval=10;
 try{
 const seller=await provider.getSigner(0),buyer=await provider.getSigner(1);
 const sa=await seller.getAddress(),ba=await buyer.getAddress();
 async function deploy(name,args=[]){const a=out.contracts['contracts/'+name+'.sol'][name];const c=await new ContractFactory(a.abi,a.evm.bytecode.object,seller).deploy(...args);await c.waitForDeployment();return c;}
 const asset=await deploy('MarketAsset'),currency=await deploy('DemoToken');
 const market=await deploy('TokenMarket',[await asset.getAddress(),await currency.getAddress()]);
 const ma=await market.getAddress(),tx=async p=>(await p).wait();
 await tx(asset.faucet());await tx(currency.connect(buyer).faucet());
 await tx(asset.approve(ma,U('1000')));
 await assert.rejects(market.createListing('',U('1'),U('1')));
 await tx(market.createListing('Test AUR lot',U('100'),U('50')));
 assert.equal(await asset.balanceOf(ma),U('100'));
 await assert.rejects(market.buy(0));
 await assert.rejects(market.connect(buyer).cancel(0));
 await assert.rejects(market.connect(buyer).buy(0));
 assert.equal((await market.listListings(0,10))[0].status,0n);
 await tx(currency.connect(buyer).approve(ma,U('50')));
 await tx(market.connect(buyer).buy(0));
 assert.equal(await asset.balanceOf(ba),U('100'));
 assert.equal(await currency.balanceOf(sa),U('50'));
 assert.equal(await currency.balanceOf(ba),U('99950'));
 assert.equal(await asset.balanceOf(ma),0n);
 await assert.rejects(market.connect(buyer).buy(0));
 await assert.rejects(market.cancel(0));
 await tx(market.createListing('Cancel me',U('40'),U('20')));
 await tx(market.cancel(1));
 assert.equal(await asset.balanceOf(sa),U('99900'));
 const rows=await market.listListings(0,50);
 assert.equal(rows[0].id,1n);assert.equal(rows[0].status,2n);assert.equal(rows[1].buyer,ba);
 assert.equal((await market.listListings(2,50)).length,0);
 await assert.rejects(market.listListings(0,51));
 }finally{await rpc.disconnect();}
});
