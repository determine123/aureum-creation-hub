import ganache from 'ganache';
const server=ganache.server({chain:{chainId:31337,hardfork:'shanghai'},miner:{blockTime:1},wallet:{totalAccounts:32,defaultBalance:1000},logging:{quiet:true}});
await server.listen(8545,'127.0.0.1');
console.log('Local EVM ready: http://127.0.0.1:8545 · chain 31337 · unlocked development accounts');
console.log('Development only. Use the local wallet selector in the app; never fund these accounts on a public network.');
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();process.exit(0)});
