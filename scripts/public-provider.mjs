import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {FetchRequest,JsonRpcProvider} from 'ethers';
const run=promisify(execFile);
/** Optional existing HTTPS_PROXY for read-only public RPC calls, never wallet signing. */
export function publicProvider(url){
 const request=new FetchRequest(url);request.timeout=55000;
 if(process.env.HTTPS_PROXY){
  request.getUrlFunc=async req=>{
   const body=req.body?Buffer.from(req.body).toString('utf8'):'';
   const calls=JSON.parse(body||'{}');
   for(const call of Array.isArray(calls)?calls:[calls])if(!/^(eth_(chainId|get\w+|call|estimateGas|gasPrice|maxPriorityFeePerGas|feeHistory|blockNumber)|net_version)$/.test(call.method))throw Error('Proxy transport supports read-only RPC only');
   const {stdout}=await run(process.platform==='win32'?'curl.exe':'curl',['--proxy',process.env.HTTPS_PROXY,'--http1.1','--silent','--show-error','--connect-timeout','8','--max-time','15','--retry','2','--retry-all-errors','--retry-delay','1',req.url,'-H','Content-Type: application/json','--data-raw',body,'--write-out','\n%{http_code}'],{windowsHide:true,maxBuffer:16*1024*1024});
   const split=stdout.lastIndexOf('\n');return {statusCode:Number(stdout.slice(split+1)),statusMessage:'',headers:{'content-type':'application/json'},body:Buffer.from(stdout.slice(0,split))};
  };
 }
 const provider=new JsonRpcProvider(request,undefined,{cacheTimeout:-1});provider.pollingInterval=1000;return provider;
}
