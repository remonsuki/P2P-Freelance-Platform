/**
 * 區塊鏈操作入口。
 * 集中處理 MetaMask、ethers、代幣餘額與 SKILL 託管交易；
 * 不依賴 React；付款與結算完全由合約執行。
 */
import { BrowserProvider, Contract, formatUnits, getAddress, verifyTypedData } from 'ethers';
import protocol from '../../../blockchain/protocol.json' with {type:'json'};
import {
  SKILL_TOKEN_ADDRESS,
  SKILL_TOKEN_ABI,
} from '../config/contracts.js';

function getEthereum() {
  return globalThis.window?.ethereum;
}

export function isWalletAvailable() {
  return Boolean(getEthereum());
}

function walletErrorNodes(error) {
  const pending=[error],seen=new Set(),nodes=[];
  while(pending.length&&nodes.length<30) {
    const node=pending.shift();
    if(!node||typeof node!=='object'||seen.has(node))continue;
    seen.add(node);nodes.push(node);
    pending.push(node.cause,node.error,node.info?.error,node.data?.originalError,node.data?.cause);
  }
  return nodes;
}

/** ethers may wrap an EIP-1193 code in error, info.error or cause. */
export function walletErrorCode(error) {
  const nodes=walletErrorNodes(error);
  for(const node of nodes) {
    const code=Number(node.code);
    if([4001,4100,4200,4900,4901,4902,-32002].includes(code))return code;
  }
  return nodes.find(node=>node.code!==undefined)?.code;
}

export function walletErrorMessage(error) {
  const nodes=walletErrorNodes(error),code=walletErrorCode(error);
  if(code===4100) return 'MetaMask 尚未授權此網站使用綁定錢包（4100）。請到錢包頁按「重新授權綁定錢包」，勾選原本綁定的地址後確認。';
  if(code===4001||nodes.some(node=>node.code==='ACTION_REJECTED'))return '你已取消 MetaMask 操作，可在準備好後重試。';
  if(code===-32002)return 'MetaMask 已有待處理的要求，請先開啟擴充套件完成或取消該要求。';
  if(code===4900||code===4901)return 'MetaMask 尚未連上交易網路，請確認本機節點已啟動，再從錢包頁重新連線。';
  for(const node of nodes) {
    for(const message of [node.reason,node.shortMessage,node.message]) {
      if(typeof message==='string'&&message.trim()&&!/could not coalesce error|unknown error|internal json-rpc error|missing revert data/i.test(message)) return message.split(' (')[0].slice(0,500);
    }
  }
  return '錢包操作未完成，請重新連線後再試。';
}

function permissionError(message='MetaMask 尚未授權綁定錢包') {
  return Object.assign(new Error(message),{code:4100});
}

/** 要求使用者授權錢包；此操作不會建立平台會員登入狀態。 */
export async function requestWalletConnection({expectedAddress,reauthorize=false}={}) {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('未偵測到 MetaMask，請先安裝瀏覽器擴充套件。');
  }

  try {
    if(reauthorize) await ethereum.request({method:'wallet_requestPermissions',params:[{eth_accounts:{}}]});
    const accounts = await ethereum.request({ method: reauthorize?'eth_accounts':'eth_requestAccounts' });
    const address=expectedAddress?accounts.find(a=>a.toLowerCase()===expectedAddress.toLowerCase()):accounts[0];
    if(!address) throw permissionError();
    return getAddress(address);
  } catch (err) {
    throw new Error(walletErrorMessage(err), { cause: err });
  }
}

/** 讀取已授權帳戶，不跳出授權視窗。 */
export async function getAuthorizedWalletAccounts() {
  const ethereum = getEthereum();
  return ethereum ? ethereum.request({ method: 'eth_accounts' }) : [];
}

export async function createWalletSession(expectedAddress) {
  const ethereum = getEthereum();
  if (!ethereum) {
    throw new Error('未偵測到 MetaMask，請先安裝瀏覽器擴充套件。');
  }
  const accounts=await getAuthorizedWalletAccounts();
  const address=expectedAddress?accounts.find(a=>a.toLowerCase()===expectedAddress.toLowerCase()):accounts[0];
  if(!address) throw permissionError();
  const provider = new BrowserProvider(ethereum);
  try {
    const signer = await provider.getSigner(getAddress(address));
    return { address:getAddress(address),provider, signer };
  } catch(error) {provider.destroy();throw new Error(walletErrorMessage(error),{cause:error});}
}

/** Permission recovery is limited to connection/read checks, before any payment quote or transfer. */
export async function connectAuthorizedWallet({expectedAddress,paymentNetwork,reauthorize=false}={}) {
  let force=reauthorize;
  for(let attempt=0;attempt<2;attempt++) {
    let session;
    try {
      const address=await requestWalletConnection({expectedAddress,reauthorize:force});
      if(paymentNetwork) await switchPaymentNetwork(paymentNetwork);
      session=await createWalletSession(address);
      if(paymentNetwork) await ensurePaymentNetwork(session.signer,paymentNetwork);
      return session;
    } catch(error) {
      session?.provider.destroy();
      if(walletErrorCode(error)===4100&&!force) {force=true;continue;}
      throw new Error(walletErrorMessage(error),{cause:error});
    }
  }
  throw permissionError();
}

/** 回傳清理函式，讓呼叫端在卸載時移除相同的監聽器。 */
export function subscribeWalletEvents({ onAccountsChanged, onChainChanged }) {
  const ethereum = getEthereum();
  if (!ethereum) return () => {};

  ethereum.on('accountsChanged', onAccountsChanged);
  ethereum.on('chainChanged', onChainChanged);
  return () => {
    ethereum.removeListener('accountsChanged', onAccountsChanged);
    ethereum.removeListener('chainChanged', onChainChanged);
  };
}

/** 使用字串保留代幣小數精度，餘額只從鏈上讀取。 */
export async function readSkillBalance(signerOrProvider, userAddress, tokenAddress=SKILL_TOKEN_ADDRESS, blockTag='latest') {
  if (!signerOrProvider || !userAddress) return null;
  const token = new Contract(tokenAddress, SKILL_TOKEN_ABI, signerOrProvider);
  const raw = await token.balanceOf(userAddress,{blockTag});
  const decimals = await token.decimals();
  return formatUnits(raw, decimals);
}

let switchingNetwork=false;

/** Ask MetaMask to switch; only add an unknown chain using the server's public metadata. */
export async function switchPaymentNetwork(config,ethereum=getEthereum()) {
  if(!ethereum) throw new Error('未偵測到 MetaMask，請先安裝瀏覽器擴充套件。');
  if(!config?.enabled||![1337,31337,11155111].includes(Number(config.chainId))) throw new Error('交易網路尚未就緒');
  if(switchingNetwork) throw new Error('網路切換正在處理，請先回覆 MetaMask 的視窗');
  const chainId='0x'+Number(config.chainId).toString(16);
  switchingNetwork=true;
  try {
    if(BigInt(await ethereum.request({method:'eth_chainId'}))===BigInt(chainId)) return false;
    try {await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
    catch(error) {
      const code=error.code??error.data?.originalError?.code;
      if(Number(code)!==4902) throw error;
      const network=config.walletNetwork;
      if(!network?.rpcUrls?.length||BigInt(network.chainId)!==BigInt(chainId)) throw new Error('MetaMask 尚未加入此網路，請依錢包頁的 RPC 與 Chain ID 手動新增；若未顯示 RPC，請先重啟後端',{cause:error});
      await ethereum.request({method:'wallet_addEthereumChain',params:[network]});
      // Adding a chain does not guarantee it became the active chain.
      if(BigInt(await ethereum.request({method:'eth_chainId'}))!==BigInt(chainId)) await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
    }
    if(BigInt(await ethereum.request({method:'eth_chainId'}))!==BigInt(chainId)) throw new Error('MetaMask 尚未切換成功，請在錢包選擇交易網路後再試');
    return true;
  } catch(error) {
    const code=Number(error.code??error.data?.originalError?.code);
    if(code===4001||error.code==='ACTION_REJECTED') throw new Error('你已取消新增或切換網路，確認 MetaMask 網路後即可重試',{cause:error});
    if(code===-32002) throw new Error('MetaMask 已有待處理的要求，請先開啟擴充套件完成或取消該要求',{cause:error});
    throw error;
  } finally {switchingNetwork=false;}
}

export async function ensurePaymentNetwork(signer, networkConfig) {
  if (!signer) throw new Error('請先連線 MetaMask 錢包');
  const config=typeof networkConfig==='object'?networkConfig:null;
  const chainId=config?.chainId??networkConfig;
  const network = await signer.provider.getNetwork();
  if (network.chainId !== BigInt(chainId)) throw new Error(`請在 MetaMask 切換至 ${Number(chainId) === 11155111 ? 'Sepolia' : `測試鏈 ${chainId}`}，重新連線後再試`);
  if(config) {
    const code=await Promise.all([signer.provider.getCode(config.tokenAddress),signer.provider.getCode(config.escrowAddress)]);
    if(code.some(value=>value==='0x')) throw new Error(`網路編號正確，但找不到本專案合約。請確認 MetaMask 的 RPC 設為 ${config.walletNetwork?.rpcUrls?.[0]||'錢包頁顯示的交易 RPC'}，再重新連線`);
  }
}

/** Backend-signed quotes are the authority for the SKILL amount, payee and booking. */
export async function fundSkillPayment({signer,payment,onProgress=()=>{},onSubmitted=()=>{},onReceipt=async()=>{}}) {
  await ensurePaymentNetwork(signer,payment.chainId);
  const address = await signer.getAddress();
  if (address.toLowerCase() !== payment.quote.student.toLowerCase()) throw new Error('目前錢包與此筆付款的學生地址不同');
  const escrow = new Contract(payment.escrowAddress,protocol.abi,signer);
  if (getAddress(await escrow.token()) !== getAddress(payment.tokenAddress)) throw new Error('託管合約的代幣設定不符');
  const domain = {name:protocol.name,version:protocol.version,chainId:payment.chainId,verifyingContract:payment.escrowAddress};
  if (getAddress(verifyTypedData(domain,protocol.types,payment.quote,payment.signature)) !== getAddress(await escrow.quoteSigner())) throw new Error('報價簽章不正確');
  const current = await escrow.getPayment(payment.paymentId);
  if (Number(current.state)>0) return null;
  const head = await signer.provider.getBlock('latest');
  if (head.timestamp>Number(payment.quote.deadline)) throw new Error('付款報價已過期，請先同步付款狀態');
  const token = new Contract(payment.tokenAddress,SKILL_TOKEN_ABI,signer);
  const amount = BigInt(payment.quote.amount);
  if (await token.balanceOf(address)<amount) throw new Error('鏈上 SKILL 餘額不足');
  if (await token.allowance(address,payment.escrowAddress)<amount) {
    onProgress('請在 MetaMask 授權本筆 SKILL 金額');
    const approval=await token.approve(payment.escrowAddress,amount);
    await onReceipt(await waitForPaymentTransaction(approval));
  }
  onProgress('請在 MetaMask 確認付款至託管合約');
  const tx=await escrow.fund(payment.quote,payment.signature);
  onSubmitted(tx.hash);
  onProgress('付款已送出，等待區塊確認');
  await onReceipt(await waitForPaymentTransaction(tx));
  return tx.hash;
}

export async function waitForPaymentTransaction(tx) {
  let receipt;
  try {receipt=await tx.wait(1);}
  catch(error) {
    if(error.code==='TRANSACTION_REPLACED'&&!error.cancelled) receipt=error.receipt;
    else throw error;
  }
  if (!receipt || receipt.status!==1) throw new Error('鏈上交易未成功，請至預約管理同步確認');
  return receipt;
}

export async function changeSkillPayment({signer,payment,action,onSubmitted=()=>{},onReceipt=async()=>{}}) {
  if (!['cancel','complete','dispute','refund','claim'].includes(action)) throw new Error('不支援的交易操作');
  await ensurePaymentNetwork(signer,payment.chainId);
  const actor=await signer.getAddress();
  const expected=['refund','claim'].includes(action)?payment.quote.teacher:payment.quote.student;
  if (actor.toLowerCase()!==expected.toLowerCase()) throw new Error('請連接此筆交易原本的收付款錢包');
  const contract=new Contract(payment.escrowAddress,protocol.abi,signer);
  const tx=await contract[action](payment.paymentId);
  onSubmitted(tx.hash);
  const receipt=await waitForPaymentTransaction(tx);
  await onReceipt(receipt);
  return receipt;
}
