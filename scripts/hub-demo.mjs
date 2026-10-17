import fs from 'node:fs';
import {spawn} from 'node:child_process';
import ganache from 'ganache';
import {JsonRpcProvider,ContractFactory,parseEther} from 'ethers';
import {compile} from './compile.mjs';

export async function createDemo(port=18645,chainId=31337){
 const server=ganache.server({logging:{quiet:true},wallet:{totalAccounts:4},chain:{chainId,hardfork:'shanghai'}});
 await server.listen(port);
 const provider=new JsonRpcProvider('http://127.0.0.1:'+port,undefined,{cacheTimeout:-1});provider.pollingInterval=50;
 try{
  const deployer=await provider.getSigner(0);
  async function deploy(name,args=[]){const a=JSON.parse(fs.readFileSync('artifacts/'+name+'.json'));const c=await new ContractFactory(a.abi,a.evm.bytecode.object,deployer).deploy(...args);await c.waitForDeployment();return c;}
  const token=await deploy('DemoToken'),hub=await deploy('CreationHub',[await token.getAddress()]);
  const creations=[
   ['Re:Campus · 校园物品循环计划','让闲置找到下一位主人。一个从校园出发的循环经济产品原型。','项目想法：用公开商品目录、链上托管与原子交易，为校园闲置物品提供可验证的流转记录。\n\n当前演示内容：产品构思与技术架构，不代表已上线的校方服务。\n\n下一步：完善交付确认机制，邀请同学共同测试。','',0],
   ['一个让灵感找到队友的地方','不止收藏好点子，更让愿意一起做的人相遇。','Idea：把一句话想法拆成问题、目标用户和第一步实验。\n\n希望参与者通过小额测试币支持表达兴趣，作者用公开更新记录进展。\n\n这些示例文案由本项目原创，仅用于比赛演示。','',1],
   ['Commit Lens · 链上承诺校验器','把 commit–reveal 的编码与校验过程讲清楚。','工具设计：用 keccak256(abi.encode(price,address,salt)) 生成承诺。\n\n注意区分 Unicode 码点数量与 UTF-8 字节数；演示前应同时测试中文和 Emoji。\n\n本条为工具说明示例，未附外部可运行工具。','',2],
   ['从 Idea 到 Demo：一天黑客松清单','问题 → 核心流程 → 合约测试 → 可演示页面。','1. 用一句话说明你服务谁、解决什么问题。\n2. 只选择一条能在现场完整跑通的流程。\n3. 为关键资金路径写失败与回滚测试。\n4. 提前准备双钱包与手机端演示。\n5. 如实标注本地测试、公共部署与未完成项。','',3],
   ['开放共创：把你的下一步放在这里','项目、创意、工具、经验，甚至一个尚未成形的问题。','这里没有规定作品的形态。你可以分享一段经历、一项开放任务或一个跨学科的小实验。\n\n请只发布你有权分享的内容；所有正文公开上链。','',4]
  ];
  for(let i=0;i<creations.length;i++){const author=await provider.getSigner(i%2);await(await hub.connect(author).publish(...creations[i])).wait();}
  const supporter=await provider.getSigner(2);await(await token.connect(supporter).faucet()).wait();await(await token.connect(supporter).approve(await hub.getAddress(),parseEther('35'))).wait();await(await hub.connect(supporter).support(0,parseEther('25'))).wait();await(await hub.connect(supporter).support(1,parseEther('10'))).wait();await(await hub.connect(supporter).setSaved(0,true)).wait();
  const config={chainId,rpcUrl:'http://127.0.0.1:'+port,token:await token.getAddress(),hub:await hub.getAddress()};
  return {server,provider,token,hub,config};
 }catch(error){provider.destroy();await server.close();throw error;}
}

if(process.argv[1]?.endsWith('hub-demo.mjs')){
 compile();const demo=await createDemo();
 const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','15175','--strictPort'],{stdio:'inherit',windowsHide:true,env:{...process.env,VITE_LOCAL_DEMO:JSON.stringify(demo.config)}});
 console.log('\nAUREUM demo: http://127.0.0.1:15175\n4 local unlocked wallets; original demo content is genuinely published on the local chain.\n'+JSON.stringify(demo.config));
 async function close(){vite.kill();demo.provider.destroy();await demo.server.close();process.exit(0);}
 process.on('SIGINT',close);process.on('SIGTERM',close);
}
