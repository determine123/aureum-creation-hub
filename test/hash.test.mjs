import test from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,AbiCoder,keccak256} from 'ethers';
import solc from 'solc';
import fs from 'node:fs';
test('price hash: typed encoding, address binding, exactly 18 Unicode characters',async()=>{
  const source=fs.readFileSync('contracts/PriceHash.sol','utf8')+'\ncontract HashHarness {function priceHash(uint256 p,address a,string memory s) external pure returns(bytes32){return PriceHash.hash(p,a,s);}}';
  const input={language:'Solidity',sources:{'Hash.sol':{content:source}},settings:{evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
  const out=JSON.parse(solc.compile(JSON.stringify(input)));
  assert.equal(out.errors?.filter(e=>e.severity==='error').length??0,0);
  const artifact=out.contracts['Hash.sol'].HashHarness;
  const rpc=ganache.provider({logging:{quiet:true}});
  try{
    const provider=new BrowserProvider(rpc);const signer=await provider.getSigner();
    const contract=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,signer).deploy();await contract.waitForDeployment();
    const address=await signer.getAddress();
    for(const salt of ['123456789012345678','!@#$%^&*()_+-=[]{}','竞'.repeat(18),'🚀'.repeat(18),' '.repeat(18)]){
      const expected=keccak256(AbiCoder.defaultAbiCoder().encode(['uint256','address','string'],[123,address,salt]));
      assert.equal(await contract.priceHash(123,address,salt),expected);
    }
    for(const salt of ['','a'.repeat(17),'a'.repeat(19)]) await assert.rejects(contract.priceHash(123,address,salt));
    const salt='123456789012345678';
    assert.notEqual(await contract.priceHash(123,address,salt),await contract.priceHash(124,address,salt));
    assert.notEqual(await contract.priceHash(123,address,salt),await contract.priceHash(123,'0x0000000000000000000000000000000000000001',salt));
  }finally{await rpc.disconnect();}
});
