import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ContractFactory,formatEther,type JsonRpcSigner,ZeroHash,ZeroAddress} from 'ethers';
import {DEPOSIT,PHASES,amount,auctionContract,createClient,errorText,getAuction,getPlayers,injected,parsePrice,readConfig,saveConfig,send,short,tokenContract,validateAddress,type Auction,type Config,type Player} from './chain';
import {downloadSecret,loadSecret,newSalt,priceHash,saveSecret,secretKey,validateSalt,type Secret} from './secrets';
import localDeployment from './deployment.json';
import './style.css';

const initialConfig=readConfig();
type Own={index:number;lastPrice:bigint;revealedRounds:number;commitment:string;revealed:boolean;claimable:bigint;refunded:boolean};
function App(){
  const [config,setConfig]=useState<Config>(initialConfig);
  const client=useMemo(()=>createClient(config),[config]);
  const [signer,setSigner]=useState<JsonRpcSigner|null>(null),[account,setAccount]=useState('');
  const [selected,setSelected]=useState<number|null>(null),[room,setRoom]=useState<Auction|null>(null);
  const [rooms,setRooms]=useState<Auction[]>([]),[count,setCount]=useState(0),[listPage,setListPage]=useState(0);
  const [players,setPlayers]=useState<Player[]>([]),[playersPage,setPlayersPage]=useState(0);
  const [own,setOwn]=useState<Own|null>(null),[tokenBalance,setTokenBalance]=useState(0n),[nativeBalance,setNativeBalance]=useState(0n),[allowance,setAllowance]=useState(0n);
  const [chainTime,setChainTime]=useState(0),[observedAt,setObservedAt]=useState(Date.now()),[now,setNow]=useState(Date.now());
  const [ready,setReady]=useState(false),[readError,setReadError]=useState(''),[message,setMessage]=useState(''),[txError,setTxError]=useState(''),[pending,setPending]=useState(''),[lastHash,setLastHash]=useState('');
  const [refresh,setRefresh]=useState(0),[filter,setFilter]=useState('全部竞拍'),[modal,setModal]=useState<'create'|'wallet'|'settings'|null>(null);
  const [localAccounts,setLocalAccounts]=useState<string[]>([]),[localIndex,setLocalIndex]=useState('0');
  const [price,setPrice]=useState(''),[salt,setSalt]=useState(newSalt),[backup,setBackup]=useState(false);
  const [title,setTitle]=useState(''),[ceiling,setCeiling]=useState('75000'),[actual,setActual]=useState('42000'),[sellerSalt,setSellerSalt]=useState(newSalt);
  const [settings,setSettings]=useState<Config>(config);
  const busyRef=useRef(false);
  const local=config.chainId===31337;
  const timestamp=chainTime+Math.max(0,Math.floor((now-observedAt)/1000));
  const isSeller=!!room && account.toLowerCase()===room.seller.toLowerCase();
  const sKey=room && account?secretKey(config.chainId,config.auction,String(room.id),account,isSeller?'seller':String(room.round)):'';
  const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();

  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(t)},[]);
  useEffect(()=>()=>{client.destroy()},[client]);
  useEffect(()=>{
    const ethereum=(window as unknown as {ethereum?:{on?:(e:string,f:()=>void)=>void;removeListener?:(e:string,f:()=>void)=>void}}).ethereum;
    const reset=()=>{setSigner(null);setAccount('');setOwn(null);setMessage('钱包账户或网络已变更，请重新连接');};
    ethereum?.on?.('accountsChanged',reset);ethereum?.on?.('chainChanged',reset);
    return()=>{ethereum?.removeListener?.('accountsChanged',reset);ethereum?.removeListener?.('chainChanged',reset)};
  },[]);
  useEffect(()=>{
    let alive=true,busy=false;
    async function poll(){
      if(busy)return;busy=true;
      try{
        if(!config.auction || !config.token){if(alive){setReady(false);setReadError('尚未配置合约地址。可在网络设置中部署或连接测试网合约。')}return;}
        const [network,code,tokenCode,block]=await Promise.all([client.send('eth_chainId',[]),client.getCode(config.auction),client.getCode(config.token),client.getBlock('latest')]);
        if(Number(BigInt(network))!==config.chainId)throw Error('RPC 返回的链 ID 与配置不一致');
        if(code==='0x' || tokenCode==='0x')throw Error('该网络上没有配置的合约。请重新部署或更新网络设置。');
        const contract=auctionContract(config,client);
        if(!same(await contract.token(),config.token))throw Error('竞拍合约的代币地址与配置不一致');
        const total=Number(await contract.auctionCount());
        const ids=Array.from({length:Math.min(12,Math.max(0,total-listPage*12))},(_,i)=>total-listPage*12-i);
        const list=await Promise.all(ids.map(id=>getAuction(config,client,id)));
        let detail:Auction|null=null,ps:Player[]=[],me:Own|null=null;
        if(selected){detail=await getAuction(config,client,selected);ps=await getPlayers(config,client,detail,playersPage);
          if(account){const [p,b,claimable,refunded]=await Promise.all([contract.players(selected,account),contract.bids(selected,detail.round,account),contract.claimable(selected,account),contract.refunded(selected,account)]);me={index:Number(p.index),lastPrice:p.lastPrice,revealedRounds:Number(p.revealedRounds),commitment:b.commitment,revealed:b.revealed,claimable,refunded};}}
        const balances=account?await Promise.all([tokenContract(config,client).balanceOf(account),client.getBalance(account),tokenContract(config,client).allowance(account,config.auction)]):[0n,0n,0n];
        if(alive){setRooms(list);setCount(total);setRoom(detail);setPlayers(ps);setOwn(me);setTokenBalance(balances[0]);setNativeBalance(balances[1]);setAllowance(balances[2]);setReady(true);setReadError('');if(block){setChainTime(block.timestamp);setObservedAt(Date.now());}}
      }catch(e){if(alive){setReadError(errorText(e));setReady(false)}}finally{busy=false}
    }
    void poll();const t=setInterval(poll,2000);return()=>{alive=false;clearInterval(t)};
  },[client,config,selected,account,listPage,playersPage,refresh]);
  useEffect(()=>{
    let saved=sKey?loadSecret(sKey):null;
    if(!saved && sKey && isSeller && room){
      const draft=loadSecret(secretKey(config.chainId,config.auction,'draft',account,'seller'));
      if(draft?.commitment===room.sellerCommitment){saved=draft;saveSecret(sKey,draft);}
    }
    setPrice(saved?.price??'');setSalt(saved?.salt??newSalt());setBackup(!!saved);
  },[sKey]);

  async function run(label:string,work:()=>Promise<void>){
    if(busyRef.current)return;busyRef.current=true;setPending(label);setTxError('');setMessage('');setLastHash('');
    try{await work();setMessage(`${label}完成，页面状态已更新`);setRefresh(x=>x+1)}catch(e){setTxError(errorText(e))}finally{busyRef.current=false;setPending('')}
  }
  async function transact(method:string,args:unknown[]=[],target='auction'){
    if(!signer)throw Error('请先连接钱包');
    if(Number((await signer.provider.getNetwork()).chainId)!==config.chainId)throw Error('钱包网络已变更，请重新连接');
    const contract=target==='token'?tokenContract(config,signer):auctionContract(config,signer);
    const tx=await send(contract,method,args);setLastHash(tx.hash);const receipt=await tx.wait();if(!receipt || receipt.status!==1)throw Error('交易执行失败');return receipt;
  }
  const doAction=(label:string,method:string,args:unknown[]=[],target='auction')=>void run(label,async()=>{await transact(method,args,target)});
  async function connectLocal(){await run('连接本地钱包',async()=>{if(config.chainId!==31337 || !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(config.rpcUrl))throw Error('开发钱包仅允许本机 31337 网络');const s=await client.getSigner(Number(localIndex));setSigner(s);setAccount(await s.getAddress());setModal(null)});}
  async function connectExternal(){await run('连接钱包',async()=>{const s=await injected(config);setSigner(s);setAccount(await s.getAddress());setModal(null)});}
  function openWallet(){setModal('wallet');if(local)void client.send('eth_accounts',[]).then(setLocalAccounts).catch(()=>setLocalAccounts([]));}
  function enter(id:number){setSelected(id);setRoom(null);setPlayersPage(0);setTxError('');setMessage('');}
  async function createRoom(){await run('创建竞拍',async()=>{
    if(!account)throw Error('请先连接钱包');const cap=parsePrice(ceiling),p=parsePrice(actual);validateSalt(sellerSalt);
    if(cap<=0n || cap>DEPOSIT || p>cap)throw Error('限价必须在 0–100,000 内，实际价格不得超过限价');
    if(!title.trim() || new TextEncoder().encode(title.trim()).length>120)throw Error('标题不能为空，且最多 120 个 UTF-8 字节');
    const secret={price:actual,salt:sellerSalt,commitment:priceHash(p,account,sellerSalt)};
    // Save before asking the wallet to sign. The temporary key survives a lost receipt.
    saveSecret(secretKey(config.chainId,config.auction,'draft',account,'seller'),secret);
    const receipt=await transact('createAuction',[title.trim(),cap,secret.commitment]);
    const contract=auctionContract(config,client);let id:number|undefined;
    for(const log of receipt.logs){try{const parsed=contract.interface.parseLog({topics:[...log.topics],data:log.data});if(parsed?.name==='AuctionCreated')id=Number(parsed.args.id)}catch{/* Other contract's event. */}}
    if(!id)throw Error('创建交易成功，但未解析到竞拍 ID，请在大厅检查并使用草稿备份');
    saveSecret(secretKey(config.chainId,config.auction,String(id),account,'seller'),secret);
    setModal(null);setTitle('');setSellerSalt(newSalt());setListPage(0);enter(id);
  });}
  async function commit(){await run('提交密封报价',async()=>{
    if(!room || !account)throw Error('请连接钱包并选择竞拍');const p=parsePrice(price);validateSalt(salt);
    if(p>room.ceiling || p<(own?.lastPrice??0n))throw Error('报价必须不低于上一轮，且不超过公开限价');
    const commitment=priceHash(p,account,salt);saveSecret(sKey,{price,salt,commitment});setBackup(true);
    await transact('commitBid',[room.id,commitment]);
  });}
  async function reveal(){await run(isSeller?'揭露实际价格':'揭露报价',async()=>{
    if(!room || !account)throw Error('请选择竞拍');const p=parsePrice(price);const commitment=priceHash(p,account,salt);
    const expected=isSeller?room.sellerCommitment:own?.commitment;
    if(commitment!==expected)throw Error('价格或 salt 与链上 hash 不匹配，请导入正确备份');
    await transact(isSeller?'revealSeller':'revealBid',[room.id,p,salt]);
  });}
  function exportCurrent(){try{if(!account || !sKey)throw Error('请先连接钱包');downloadSecret(sKey,{price,salt,commitment:priceHash(parsePrice(price),account,salt)});setBackup(true)}catch(e){setTxError(errorText(e))}}
  async function importCurrent(file:File){try{const value=JSON.parse(await file.text()) as Secret&{key:string};if(value.key!==sKey)throw Error('备份属于另一条链、合约、竞拍、账户或轮次');if(priceHash(parsePrice(value.price),account,value.salt)!==value.commitment)throw Error('备份内容校验失败');saveSecret(sKey,value);setPrice(value.price);setSalt(value.salt);setBackup(true);setMessage('已恢复本机揭露备份')}catch(e){setTxError(errorText(e))}}
  async function applySettings(){await run('保存网络配置',async()=>{
    if(![31337,10143].includes(settings.chainId))throw Error('只支持本地链或 Monad 测试网');
    const u=new URL(settings.rpcUrl);if(!['http:','https:'].includes(u.protocol))throw Error('RPC 必须为 HTTP(S) 地址');
    if(settings.chainId===10143 && u.protocol!=='https:')throw Error('测试网请使用 HTTPS RPC');
    const next={...settings,auction:settings.auction?validateAddress(settings.auction):'',token:settings.token?validateAddress(settings.token):''};
    saveConfig(next);setSigner(null);setAccount('');setConfig(next);setSelected(null);setListPage(0);setModal(null);
  });}
  function exportDeployment(){const url=URL.createObjectURL(new Blob([JSON.stringify(config,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='deployment-testnet.json';a.click();URL.revokeObjectURL(url);}
  async function deployTestnet(){await run('部署测试网合约',async()=>{
    if(config.chainId!==10143 || !signer)throw Error('请先保存 Monad 测试网配置，并连接浏览器钱包');
    const deployArtifacts=(await import('./generated/deploy.json')).default;
    const deployKey=`aureum:deployment:${config.chainId}:${account.toLowerCase()}`;
    let token=localStorage.getItem(deployKey)??'';
    if(token && await client.getCode(token)==='0x')token='';
    if(!token){setPending('部署测试代币 · 请确认钱包交易');const f=new ContractFactory(deployArtifacts.DemoToken.abi,deployArtifacts.DemoToken.bytecode,signer);const req=await f.getDeployTransaction();const gas=await signer.estimateGas(req);const c=await f.deploy({gasLimit:gas+gas/10n});setLastHash(c.deploymentTransaction()?.hash??'');await c.waitForDeployment();token=await c.getAddress();localStorage.setItem(deployKey,token);}
    setPending('部署竞拍合约 · 请确认第二笔钱包交易');const f=new ContractFactory(deployArtifacts.BlindAuction.abi,deployArtifacts.BlindAuction.bytecode,signer);const req=await f.getDeployTransaction(token);const gas=await signer.estimateGas(req);const c=await f.deploy(token,{gasLimit:gas+gas/10n});setLastHash(c.deploymentTransaction()?.hash??'');await c.waitForDeployment();
    const next={...config,token,auction:await c.getAddress()};saveConfig(next);setConfig(next);setSettings(next);setSelected(null);setModal(null);
  });}

  const activeRooms=rooms.filter(a=>filter==='全部竞拍'||(filter==='进行中' && a.phase>=1 && a.phase<=5)||(filter==='等待报名' && a.phase===0)||(filter==='已结束' && a.phase>=6));
  const deadline=room?room.phase===1?room.roundStart:room.phase===2?room.roundStart+30:room.phase===3?room.roundStart+60:room.phase===5?room.sellerDeadline:0:0;
  const countdown=deadline?Math.max(0,deadline-timestamp):0;
  const participant=!!own && own.index>0;
  const eligible=participant && !!room && own!.revealedRounds>=room.round-1;
  const canCommit=room?.phase===2 && eligible && own?.commitment===ZeroHash;
  const canReveal=room?.phase===3 && participant && own?.commitment!==ZeroHash && !own?.revealed;
  const canSellerReveal=room?.phase===5 && isSeller && timestamp<room.sellerDeadline;
  const ended=room && room.phase>=6;
  const actionsDisabled=!!pending || !ready || !account;
  return <>
    <nav><div className="brand" onClick={()=>setSelected(null)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter')setSelected(null)}} aria-label="返回大厅"><span className="mark"><b>Λ</b></span>AUREUM</div><div className="navlinks"><span>竞拍大厅</span><span>SEALED-BID AUCTIONS</span></div><div className="wallet"><span className="network"><i className="dot"/>{local?'LOCAL EVM':'MONAD TESTNET'}</span>{account&&<span className="balance" title={`${formatEther(nativeBalance)} MON · ${formatEther(tokenBalance)} BLITZ`}>{amount(tokenBalance)} BLITZ · {Number(formatEther(nativeBalance)).toFixed(3)} MON</span>}<button className="btn" onClick={openWallet}>{account?short(account):'连接钱包 ↗'}</button><button className="btn ghost" onClick={()=>{setSettings(config);setModal('settings')}} aria-label="网络设置">⚙</button></div></nav>
    <main>
      <div className="statusbar"><span className="dot" style={{background:ready?'#7eb58f':'#bd8b58'}}/>{local?'本地 EVM · 所有操作执行真实合约交易':'Monad 测试网 · 所有竞拍数据来自链上'}<span style={{marginLeft:'auto'}}>五轮密封竞价 / 无中心化数据库</span></div>
      {readError&&<div className="notice error" role="alert">{readError}<button className="btn ghost" onClick={()=>setRefresh(x=>x+1)}>重试</button></div>}
      {(pending||message||txError)&&<div className={`notice ${txError?'error':''}`} role={txError?'alert':'status'}>{pending?<><i className="spinner"/>{pending}…</>:txError||message}{lastHash&&<div className="hint mono">{config.chainId===10143?<a href={`https://testnet.monadscan.com/tx/${lastHash}`} target="_blank" rel="noreferrer">查看链上交易 ↗</a>:<>交易 {short(lastHash)}</>}</div>}</div>}
      {selected===null?<>
        <section className="hero"><div><div className="eyebrow">THE VALUE OF A SECRET</div><h1>让价格保密。<br/>让<span style={{color:'var(--gold)'}}>博弈</span>公开。</h1><p>五轮密封报价，三十秒决策。<br/>以链上承诺守护每次出价，让智能合约兑现每个结果。</p><div className="actions" style={{justifyContent:'flex-start'}}><button className="btn gold" style={{flex:'none'}} disabled={!ready||!!pending} onClick={()=>account?setModal('create'):openWallet()}>＋ 发起竞拍</button><button className="btn ghost" style={{flex:'none'}} disabled={!account||!ready||!!pending} onClick={()=>doAction('领取测试代币','faucet',[],'token')}>领取 100,000 BLITZ ↗</button></div></div><div className="hero-art" aria-hidden="true"><div className="orb"><span>Λ</span></div><div className="art-caption">TRUST THE CODE. KEEP THE SECRET.</div></div></section>
        <div className="stats"><Stat label="链上竞拍总数" value={String(count).padStart(2,'0')} unit="AUCTIONS"/><Stat label="每人保证金" value="100,000" unit="BLITZ"/><Stat label="提交 / 揭露窗口" value="30 / 30" unit="秒"/><Stat label="最终竞拍轮数" value="05" unit="ROUNDS"/></div>
        <div className="section-head"><h2>竞拍大厅<small>AUCTION HOUSE</small></h2><div className="filters">{['全部竞拍','进行中','等待报名','已结束'].map(f=><button key={f} className={`filter ${filter===f?'active':''}`} onClick={()=>setFilter(f)}>{f}</button>)}</div></div>
        <div className="rooms">{activeRooms.map(a=><button className="room" key={a.id} onClick={()=>enter(a.id)} aria-label={`进入 ${a.title}`}><div className="room-art"><span className="lot-number">LOT / {String(a.id).padStart(4,'0')}</span><span className={`tag ${a.phase>=6?'gray':a.phase===0?'blue':''}`}>{a.phase>=1&&a.phase<=5&&<i className="dot" style={{background:'var(--gold)'}}/>}{PHASES[a.phase]}</span><span className="glyph">{['◈','✧','◎'][a.id%3]}</span></div><div className="room-body"><div className="room-title">{a.title}</div><div className="seller">SELLER <span className="mono">{short(a.seller)}</span></div><div className="room-metrics"><div><label>公开最高限价</label><strong>{amount(a.ceiling)} <small style={{fontSize:9,color:'var(--muted)'}}>BLITZ</small></strong></div><div><label>已报名买家</label><strong>{a.count} <small style={{fontSize:9,color:'var(--muted)'}}>人</small></strong></div></div><div className="room-footer"><span>{a.phase===0?`还需 ${Math.max(0,3-a.count)} 位买家开启倒计时`:a.phase>=6?'结算结果已上链':`ROUND ${String(a.round).padStart(2,'0')} / 05`}</span><span className="arrow">↗</span></div></div></button>)}{!activeRooms.length&&<div className="empty"><div className="eyebrow">YOUR NEXT MOVE</div><h3>{ready?'这里还没有符合条件的竞拍':'正在连接链上竞拍场'}</h3><p>{ready?'领取测试代币，创建第一场竞拍。每一次报名、报价和结算都由合约处理。':'请稍候，或在网络设置中检查 RPC 与合约地址。'}</p>{ready&&<button className="btn gold" onClick={()=>account?setModal('create'):openWallet()}>发起第一场竞拍 ↗</button>}</div>}</div>
        {count>12&&<div className="actions"><button className="btn" disabled={listPage===0} onClick={()=>setListPage(x=>x-1)}>上一页</button><span className="hint">第 {listPage+1} 页 · 筛选当前页</span><button className="btn" disabled={(listPage+1)*12>=count} onClick={()=>setListPage(x=>x+1)}>下一页</button></div>}
      </>:!room?<><button className="btn back" onClick={()=>setSelected(null)}>← 返回大厅</button><p>正在读取竞拍状态…</p></>:<>
        <button className="btn ghost back" onClick={()=>{setSelected(null);setRoom(null)}}>← 返回竞拍大厅</button>
        <div className="arena-top"><div><div className="eyebrow">LOT / {String(room.id).padStart(4,'0')} · SEALED AUCTION</div><h1>{room.title}</h1><div className="hint">公开最高限价 <b style={{color:'var(--gold)'}}>{amount(room.ceiling)} BLITZ</b> · {room.count} 位买家 · 每人保证金 100,000 BLITZ</div></div><span className={`tag ${ended?'gray':''}`}>{PHASES[room.phase]}</span></div>
        <div className="phase-panel"><div><div className="eyebrow">{ended?'AUCTION CLOSED':`ROUND ${String(room.round).padStart(2,'0')} / 05`}</div><h3>{PHASES[room.phase]}</h3><div className="hint">{phaseHint(room,timestamp)}</div></div><div className="clock">{deadline?String(countdown).padStart(2,'0'):room.phase===0?`${room.count}/3`:ended?'✓':'↗'}<small>{deadline?'SECONDS REMAINING':room.phase===0?'BUYERS TO START':ended?'ONCHAIN CONFIRMED':'TRANSACTION REQUIRED'}</small></div></div>
        <div className="rounds">{[1,2,3,4,5].map(r=><div key={r} className={`round ${r===room.round?'current':r<room.round?'done':''}`}>ROUND 0{r}{r<room.round?' / 已比价':''}</div>)}</div>
        <div className="seller-card"><div className="avatar">♛</div><div style={{flex:1}}><div className="eyebrow">SELLER / 卖方 {isSeller?'· 你':''}</div><div className="mono" style={{fontSize:13,marginTop:8}}>{short(room.seller)}</div><div className="hint mono" title={room.sellerCommitment}>实际价格承诺 {short(room.sellerCommitment)}</div></div><span className="tag">{room.phase===6?room.sellerDefaulted?'超时赔付':`已揭露 ${amount(room.actualPrice)}`:room.phase===7?'保证金已解锁':room.phase===5?'等待揭露实际价格':'价格已密封'}</span></div>
        <div className="section-head"><h2>竞拍席位<small>{room.count} BUYERS</small></h2><span className="hint">蓝色边框 / 买家</span></div>
        <div className="players">{players.map(p=><div className="player" key={p.address}><div style={{display:'flex',justifyContent:'space-between'}}><div className="avatar">{String(p.index).padStart(2,'0')}</div>{same(p.address,room.winner)&&<span className="tag">赢家 ♛</span>}</div><div className="player-address mono" title={p.address}>{short(p.address)} {same(p.address,account)?'· 你':''}</div><div className="player-detail">{playerStatus(p,room)}<br/>{p.revealed?`已揭露 ${amount(p.price)} BLITZ`:p.commitment!==ZeroHash?`承诺 ${short(p.commitment)}`:`保证金 100,000 BLITZ`}</div></div>)}{room.count===0&&<div className="empty"><p>买家席位开放中 · 无人数上限</p></div>}</div>
        {room.count>16&&<div className="actions"><button className="btn" disabled={playersPage===0} onClick={()=>setPlayersPage(x=>x-1)}>上一页席位</button><span className="hint">{playersPage+1} / {Math.ceil(room.count/16)}</span><button className="btn" disabled={(playersPage+1)*16>=room.count} onClick={()=>setPlayersPage(x=>x+1)}>下一页席位</button></div>}
        <div className="bid-panel"><h3>{ended?'链上结算结果':isSeller?'卖方操作台':participant?'你的竞拍操作台':'加入这场竞拍'}</h3>
          {!account?ended?<><p>{room.phase===7?'本场未成交，所有保证金原额退还。':`赢家 ${short(room.winner)} · 出价 ${amount(room.winningBid)} BLITZ · ${room.sellerDefaulted?'卖方超时，保证金赔付赢家':`实际价格 ${amount(room.actualPrice)} BLITZ`}`}</p>{room.phase===6&&!room.sellerDefaulted&&<div className="notice">{room.winningBid<room.actualPrice?`卖方 → 赢家：${amount(room.actualPrice-room.winningBid)} BLITZ`:`赢家 → 卖方：${amount(room.winningBid-room.actualPrice)} BLITZ`}。剩余保证金退还原账户。</div>}<p className="hint">结算结果可公开查看，无需连接钱包。</p></>:<><p>连接钱包，报名并存入保证金后才能参与报价。</p><button className="btn gold" onClick={openWallet}>连接钱包 ↗</button></>:<>
          {participant&&<p>上一次有效报价：{amount(own!.lastPrice)} BLITZ{!eligible&&!ended?' · 已错过上一轮，本场不可继续报价，结束后退还保证金':''}</p>}
          {(room.phase<=1&&!participant&&!isSeller)&&<><p>报名支付 100,000 BLITZ。第 3 名买家报名后开始 30 秒倒计时，倒计时结束关闭报名。</p><Funding balance={tokenBalance} allowance={allowance} disabled={!!pending||!ready} faucet={()=>doAction('领取测试代币','faucet',[],'token')} approve={()=>doAction('授权保证金','approve',[config.auction,DEPOSIT],'token')}/><div className="actions"><button className="btn gold" disabled={actionsDisabled||tokenBalance<DEPOSIT||allowance<DEPOSIT||timestamp>=room.createdAt+86400} onClick={()=>doAction('报名竞拍','join',[room.id])}>存入保证金并报名 ↗</button></div></>}
          {(canCommit||canReveal||canSellerReveal||(isSeller&&room.phase===5))&&<><div className="form-grid"><label className="field">{isSeller?'实际价格':'本轮报价'} / BLITZ<input aria-label={isSeller?'实际价格':'本轮报价'} inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder={`最高 ${amount(room.ceiling)}`} autoComplete="off"/></label><label className="field">秘密 salt / 恰好 18 个字符<input aria-label="秘密 salt" value={salt} onChange={e=>setSalt(e.target.value)} autoComplete="off" spellCheck={false}/><span className="hint">{Array.from(salt).length} / 18 字符 {canCommit&&<button className="filter" onClick={()=>setSalt(newSalt())}>重新生成 ↻</button>}</span></label></div><div className="hint">{canCommit?'提交的交易只包含 hash；价格和 salt 保留在本机。揭露时二者将公开上链。':'合约会校验价格、钱包地址及 salt 与原 hash 一致。'}</div><div className="actions">{canCommit&&<button className="btn gold" disabled={actionsDisabled} onClick={()=>void commit()}>提交密封报价 ↗</button>}{(canReveal||canSellerReveal)&&<button className="btn gold" disabled={actionsDisabled} onClick={()=>void reveal()}>{isSeller?'揭露实际价格并结算':'揭露报价'} ↗</button>}<button className="btn" onClick={exportCurrent}>导出揭露备份 ↓</button><label className="btn" style={{textAlign:'center',cursor:'pointer'}}>导入备份 ↑<input style={{display:'none'}} type="file" accept="application/json" onChange={e=>{const file=e.target.files?.[0];if(file)void importCurrent(file);e.target.value=''}}/></label></div><p className="hint">{backup?'本机已有揭露信息，请导出备份；清理浏览器或换设备可能丢失。':'请妥善保存价格与 salt；丢失后无法从 hash 恢复。'} 勿提前分享备份。</p></>}
          {own?.commitment!==ZeroHash&&own?.commitment&&room.phase===2&&<div className="notice">本轮报价已密封。揭露窗口开启后可提交原价与 salt。<button className="btn ghost" onClick={exportCurrent}>导出备份 ↓</button></div>}
          {room.phase===3&&own?.revealed&&<div className="notice">你的报价已通过验证，等待揭露窗口结束后比价。</div>}
          {isSeller&&!ended&&room.phase!==5&&<div className="actions"><button className="btn" onClick={exportCurrent}>导出卖方揭露备份 ↓</button>{room.phase===0&&<button className="btn" disabled={actionsDisabled} onClick={()=>doAction('取消未开场竞拍','cancelLobby',[room.id])}>取消并退还保证金</button>}</div>}
          {room.phase===0&&timestamp>=room.createdAt+86400&&!isSeller&&<div className="actions"><button className="btn" disabled={actionsDisabled} onClick={()=>doAction('取消过期竞拍','cancelLobby',[room.id])}>取消过期竞拍并退款 ↗</button></div>}
          {room.phase===4&&<><p>揭露窗口已结束。任何地址均可发送比价交易，费用由发起人支付。</p><button className="btn gold" disabled={actionsDisabled} onClick={()=>doAction('请求链上比价','compare',[room.id])}>请求比价 / 推进下一轮 ↗</button></>}
          {room.phase===5&&timestamp>=room.sellerDeadline&&<><p>卖方揭露超时。任何人可触发结算，卖方保证金将赔付赢家。</p><button className="btn gold" disabled={actionsDisabled} onClick={()=>doAction('超时赔付结算','finalizeSellerTimeout',[room.id])}>触发超时结算 ↗</button></>}
          {ended&&<><p>{room.phase===7?'本场未成交，所有保证金原额退还。':`赢家 ${short(room.winner)} · 出价 ${amount(room.winningBid)} BLITZ · ${room.sellerDefaulted?'卖方超时，保证金赔付赢家':`实际价格 ${amount(room.actualPrice)} BLITZ，按差额结算`}`}</p>{room.phase===6&&!room.sellerDefaulted&&<div className="notice">{room.winningBid<room.actualPrice?`卖方 → 赢家：${amount(room.actualPrice-room.winningBid)} BLITZ`:`赢家 → 卖方：${amount(room.winningBid-room.actualPrice)} BLITZ`}。剩余保证金退还原账户。</div>}<div className="hint">自动退款进度 {Math.min(room.refundCursor,room.count+1)} / {room.count+1} 个地址（单独领取可能提前完成）。大场次支持分批发放，任何人均可触发。</div><div className="actions">{own&&own.claimable>0n&&<button className="btn gold" disabled={actionsDisabled} onClick={()=>doAction('领取剩余保证金','refundFor',[room.id,account])}>领取 {amount(own.claimable)} BLITZ ↗</button>}{room.refundCursor<room.count+1&&<button className="btn" disabled={actionsDisabled} onClick={()=>doAction('批量退还保证金','refundBatch',[room.id,50])}>为下一批参与者退款 ↗</button>}</div>{own?.refunded&&<p className="success">你的结算已完成，退款已转入钱包。</p>}</>}
          </>}
        </div>
      </>}
      <details className="rules"><summary>竞拍规则、资金结算与时间机制 ↗</summary><p>使用无真实价值的 BLITZ 测试代币。卖方及每位买家各存入 100,000 枚；公开最高限价不超过保证金，卖方实际价格也必须在限价内。第 3 位买家报名后开启 30 秒倒计时，此后每轮提交 hash 30 秒、揭露 30 秒，最多 5 轮。买家每轮必须参与并揭露才能继续，报价不得低于自己上一轮。未揭露的报价不参与排名，保证金在本场结束后原额返还。</p><p>至少两人有效揭露，且第一名严格大于第二名的 2 倍时提前成交；否则继续下一轮。第 5 轮按最高有效报价成交，同价按报名先后决定；本轮无人有效揭露则取消。成交后卖方有 120 秒揭露实际价格：赢家出价不足时，卖方向赢家支付差额；反之赢家向卖方支付差额。卖方超时未揭露，全部保证金赔付赢家。</p><p>区块链不会在没有交易时主动执行。阶段由区块时间派生，无需“开始”交易；比价、超时结算和后续批次退款由任何人发送交易推进。结算自动退还前 20 个地址，更多地址可批次退款或单独领取，避免无限循环导致资金卡住。未满 3 位买家的场次可由卖方取消，满 24 小时任何人可取消退款。</p><p>承诺公式：keccak256(abi.encode(uint256 价格, address 钱包地址, string salt))。价格以 18 位代币最小单位编码。salt 为 18 个 Unicode 码点，支持字母、数字、标点及 emoji；同一买家在同一竞拍中不可跨轮复用同一 hash。规则是数字价格游戏，不包含实物交付或 NFT 所有权转移。</p></details>
      <div className="bottom"><span>AUREUM © 2026 · BUILT FOR MONAD BLITZ</span><span>COMMIT. REVEAL. SETTLE. &nbsp; ◈ &nbsp; {ready?'链上连接正常':'等待链上连接'}</span></div>
    </main>

    {modal&&<div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget&&!pending)setModal(null)}}><section className="modal" role="dialog" aria-modal="true" aria-label={modal==='create'?'发起竞拍':modal==='wallet'?'钱包连接':'网络设置'}><div className="section-head"><h2>{modal==='create'?'发起一场竞拍':modal==='wallet'?'连接你的钱包':'网络与合约'}</h2><button className="btn ghost" disabled={!!pending} onClick={()=>setModal(null)} aria-label="关闭">✕</button></div>
      {pending&&<p className="pending"><i className="spinner"/>{pending}…</p>}{txError&&<div className="notice error" role="alert">{txError}</div>}
      {modal==='wallet'&&<><p>浏览器钱包的每笔交易由你确认。本地开发钱包仅用于本机 EVM 演示。</p><button className="btn gold" style={{width:'100%'}} disabled={!!pending} onClick={()=>void connectExternal()}>连接 MetaMask / Rabby ↗</button>{local&&<><label className="field">本地开发账户<select value={localIndex} onChange={e=>setLocalIndex(e.target.value)}>{localAccounts.map((a,i)=><option key={a} value={i}>账户 {i+1} · {short(a)}</option>)}</select></label><button className="btn" disabled={!!pending||!localAccounts.length} onClick={()=>void connectLocal()}>使用本地钱包（无需扩展）</button><p className="hint">可切换不同账户扮演卖方和买家；报价备份按账户隔离。</p></>}{account&&<div className="actions"><button className="btn ghost" disabled={!!pending} onClick={()=>{setAccount('');setSigner(null);setModal(null)}}>断开当前连接</button></div>}</>}
      {modal==='create'&&<><p>创建时将锁定 100,000 BLITZ。实际价格只提交 hash，成交后才公开。</p><Funding balance={tokenBalance} allowance={allowance} disabled={!!pending||!ready} faucet={()=>doAction('领取测试代币','faucet',[],'token')} approve={()=>doAction('授权保证金','approve',[config.auction,DEPOSIT],'token')}/><label className="field">竞拍名称<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：The Golden Number #001" maxLength={120}/></label><div className="form-grid"><label className="field">公开最高限价 / BLITZ<input value={ceiling} onChange={e=>setCeiling(e.target.value)} inputMode="decimal"/></label><label className="field">保密实际价格 / BLITZ<input value={actual} onChange={e=>setActual(e.target.value)} inputMode="decimal" autoComplete="off"/></label></div><label className="field">卖方 salt / 18 个 Unicode 字符<input value={sellerSalt} onChange={e=>setSellerSalt(e.target.value)} autoComplete="off"/><span className="hint">{Array.from(sellerSalt).length} / 18 · 请保存并勿提前分享</span></label><div className="actions"><button className="btn gold" disabled={!!pending||tokenBalance<DEPOSIT||allowance<DEPOSIT||!ready} onClick={()=>void createRoom()}>存入保证金并创建 ↗</button></div></>}
      {modal==='settings'&&<><p>大厅与席位直接读取这里配置的合约；不使用服务器数据库。</p><label className="field">网络<select value={settings.chainId} onChange={e=>{const id=Number(e.target.value);setSettings(id===31337?{...localDeployment}: {chainId:id,rpcUrl:'https://testnet-rpc.monad.xyz',token:'',auction:''})}}><option value={31337}>本地 EVM / 31337</option><option value={10143}>Monad Testnet / 10143</option></select></label><label className="field">RPC URL<input value={settings.rpcUrl} onChange={e=>setSettings({...settings,rpcUrl:e.target.value})}/></label><label className="field">BLITZ 测试代币合约<input className="mono" value={settings.token} onChange={e=>setSettings({...settings,token:e.target.value})} placeholder="0x…"/></label><label className="field">BlindAuction 合约<input className="mono" value={settings.auction} onChange={e=>setSettings({...settings,auction:e.target.value})} placeholder="0x…"/></label><button className="btn gold" disabled={!!pending} onClick={()=>void applySettings()}>保存并切换网络</button><button className="btn ghost" disabled={!config.auction||!!pending} onClick={exportDeployment}>导出当前部署配置 ↓</button>{config.chainId===10143&&<><p>没有测试网合约？先保存网络配置并连接浏览器钱包，再发起两笔部署交易。需要少量测试 MON 付 Gas。</p><button className="btn" disabled={!!pending||!signer} onClick={()=>void deployTestnet()}>用当前钱包部署测试网合约 ↗</button><p className="hint">部署会生成你自己的代币和竞拍合约。合约源码验证流程见项目 README。</p></>}</>}
    </section></div>}
  </>;
}
function Stat({label,value,unit}:{label:string;value:string;unit:string}){return <div className="stat"><div className="stat-label">{label}</div><div className="stat-value">{value}<small>{unit}</small></div></div>}
function Funding({balance,allowance,disabled,faucet,approve}:{balance:bigint;allowance:bigint;disabled:boolean;faucet:()=>void;approve:()=>void}){return <div className="notice"><div>余额 {amount(balance)} BLITZ · {allowance>=DEPOSIT?'保证金已授权':'需要授权 100,000 BLITZ'}</div><div className="actions"><button className="btn" disabled={disabled} onClick={faucet}>领取测试代币</button><button className="btn" disabled={disabled||allowance>=DEPOSIT} onClick={approve}>授权本次保证金</button></div></div>}
function phaseHint(a:Auction,t:number){return a.phase===0?t>=a.createdAt+86400?'报名场已过期，任何人可发交易取消并退款':`等待至少 3 位买家。还需 ${Math.max(0,3-a.count)} 位。`:a.phase===1?'报名仍开放。倒计时结束自动进入提交阶段。':a.phase===2?'只提交报价 hash，价格与 salt 暂不公开。':a.phase===3?'提交原始报价与 salt，合约校验承诺并更新排名。':a.phase===4?'揭露已截止。任何人可发送比价交易推进流程。':a.phase===5?t>=a.sellerDeadline?'卖方已超时，任何人可以触发保证金赔付。':'卖方须揭露承诺的实际价格，触发差额结算。':a.phase===6?'差额已记账，退款按合约规则发回原账户。':'本场未成交，参与者保证金原额退还。'}
function playerStatus(p:Player,a:Auction){if(a.phase>=6)return p.refunded?'✓ 已退还保证金':'保证金可领取';if(p.revealed)return '✓ 报价已揭露';if(p.commitment!==ZeroHash)return a.phase>=4?'未按时揭露 / 不计入排名':'◈ 已提交密封报价';if(p.revealedRounds<a.round-1)return '已退出 / 上轮未揭露';if(a.phase===4)return '未提交 / 不计入排名';return a.phase<=1?'已报名 / 保证金已锁定':'等待提交报价';}
createRoot(document.getElementById('root')!).render(<App/>);
