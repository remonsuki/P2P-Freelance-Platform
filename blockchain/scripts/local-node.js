const fs=require('node:fs');
const path=require('node:path');
const ganache=require('ganache');
const directory=path.join(__dirname,'../../.local-backups/chain-test');
const config=JSON.parse(fs.readFileSync(path.join(directory,'node-private.json'),'utf8'));
if(config.version!==1||config.chainId!==1337||config.port!==18545)throw new Error('Unexpected local-node configuration');
const dbPath=path.join(directory,'ganache');
const existing=fs.existsSync(dbPath);
const chain={chainId:1337,hardfork:'shanghai',...(existing?{}:{time:new Date(config.genesisTime)})};
// Empty blocks let ordinary MetaMask transactions reach the backend confirmation depth.
const server=ganache.server({logging:{quiet:true},chain,miner:{blockTime:1},wallet:{accounts:config.accounts},database:{dbPath},server:{ws:false}});
server.listen(config.port,'127.0.0.1').then(()=>{
  fs.writeFileSync(path.join(directory,'node.pid'),String(process.pid));
  console.log(JSON.stringify({network:'YunBarter local test chain',chainId:1337,rpcUrl:`http://127.0.0.1:${config.port}`,pid:process.pid}));
}).catch(error=>{console.error('Local chain could not start:',error.code||error.name);process.exitCode=1;});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;await server.close();}
process.on('SIGINT',()=>void stop());process.on('SIGTERM',()=>void stop());
