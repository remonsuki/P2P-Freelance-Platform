/**
 * 區塊鏈操作入口。
 * 集中處理 MetaMask、ethers、代幣餘額與 SKILL 託管交易；
 * 不依賴 React；付款與結算完全由合約執行。
 */
import { BrowserProvider, Contract, formatEther, formatUnits, getAddress, verifyTypedData } from 'ethers';
import protocol from '../../../blockchain/protocol.json' with {type:'json'};
import {
  SKILL_TOKEN_ADDRESS,
  SKILL_TOKEN_ABI,
} from '../config/contracts.js';

const SEPOLIA_CHAIN_ID=11155111n;
const SEPOLIA_CHAIN_HEX='0xaa36a7';
const SEPOLIA_CHAIN_REQUIRED='請在 MetaMask 切換至 Sepolia，重新連線後再試';

export function isSepoliaChain(chainId) {
  if(!['bigint','number','string'].includes(typeof chainId)) return false;
  try {return BigInt(chainId)===SEPOLIA_CHAIN_ID;}
  catch {return false;}
}

export function isSepoliaPaymentConfig(config) {
  return config?.enabled===true&&isSepoliaChain(config.chainId);
}

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

function isInsufficientGasError(nodes) {
  return nodes.some(node=>node.code==='INSUFFICIENT_FUNDS'||[node.reason,node.shortMessage,node.message].some(message=>/insufficient funds|not enough (?:funds|eth)/i.test(message||'')));
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
  if(code===4901)return SEPOLIA_CHAIN_REQUIRED;
  if(code===4900)return 'MetaMask 尚未連上交易網路，請檢查 MetaMask 的網路連線後，再從錢包頁重新連線。';
  if(nodes.some(node=>node.code==='TRANSACTION_REPLACED'&&node.cancelled))return '原交易已在 MetaMask 取消或被其他交易取代。';
  if(isInsufficientGasError(nodes)) {
    return '錢包的測試網 ETH 不足以支付這筆網路費。若 MetaMask 提供較低的費用選項，可查看後再試，或先補足測試網 ETH。';
  }
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
  const provider = new BrowserProvider({async request(request) {
    if (request.method==='eth_sendTransaction') {
      const [transaction]=request.params??[];
      if(!isSepoliaChain(transaction?.chainId)||!isSepoliaChain(await ethereum.request({method:'eth_chainId'}))) {
        throw Object.assign(new Error(SEPOLIA_CHAIN_REQUIRED),{code:4901});
      }
    }
    return ethereum.request(request);
  }});
  try {
    const signer = await provider.getSigner(getAddress(address));
    return { address:getAddress(address),provider, signer };
  } catch(error) {provider.destroy();throw new Error(walletErrorMessage(error),{cause:error});}
}

/** Permission recovery is limited to connection/read checks, before any payment quote or transfer. */
export async function connectAuthorizedWallet({expectedAddress,paymentNetwork,reauthorize=false}={}) {
  if(paymentNetwork&&!isSepoliaPaymentConfig(paymentNetwork)) throw new Error('Sepolia 交易網路尚未就緒');
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

function isPublicWalletRpc(value) {
  try {
    const {protocol,username,password,hostname}=new URL(value);
    const host=hostname.replace(/\.$/,'');
    return protocol==='https:'&&!username&&!password&&/\.[a-z][a-z\d-]*$/i.test(host)
      &&!/(?:^|\.)(?:localhost|local|test|invalid|example|internal)$/i.test(host);
  } catch {return false;}
}

/** Only switch to Sepolia; add it only with the deployment's public HTTPS RPC. */
export async function switchPaymentNetwork(config,ethereum=getEthereum()) {
  if(!ethereum) throw new Error('未偵測到 MetaMask，請先安裝瀏覽器擴充套件。');
  if(!isSepoliaPaymentConfig(config)) throw new Error('Sepolia 交易網路尚未就緒');
  if(switchingNetwork) throw new Error('網路切換正在處理，請先回覆 MetaMask 的視窗');
  const chainId=SEPOLIA_CHAIN_HEX;
  switchingNetwork=true;
  try {
    if(isSepoliaChain(await ethereum.request({method:'eth_chainId'}))) return false;
    try {await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId}]});}
    catch(error) {
      const code=error.code??error.data?.originalError?.code;
      if(Number(code)!==4902) throw error;
      const network=config.walletNetwork;
      if(network?.chainId!==chainId||!Array.isArray(network.rpcUrls)||!network.rpcUrls.length||!network.rpcUrls.every(isPublicWalletRpc)) {
        throw new Error('MetaMask 尚未加入 Sepolia。請在 MetaMask 中啟用或手動新增 Sepolia 後再試。',{cause:error});
      }
      await ethereum.request({method:'wallet_addEthereumChain',params:[network]});
      // Adding a chain does not guarantee it became the active chain.
      if(!isSepoliaChain(await ethereum.request({method:'eth_chainId'}))) await ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId}]});
    }
    if(!isSepoliaChain(await ethereum.request({method:'eth_chainId'}))) throw new Error('MetaMask 尚未切換成功，請在錢包選擇 Sepolia 後再試');
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
  const config=networkConfig&&typeof networkConfig==='object'?networkConfig:null;
  if (!isSepoliaChain(config?.chainId??networkConfig)) throw new Error('平台僅支援 Sepolia 交易');
  const network = await signer.provider.getNetwork();
  if (!isSepoliaChain(network.chainId)) throw new Error(SEPOLIA_CHAIN_REQUIRED);
  if(config) {
    const code=await Promise.all([signer.provider.getCode(config.tokenAddress),signer.provider.getCode(config.escrowAddress)]);
    if(code.some(value=>value==='0x')) throw new Error('網路編號正確，但找不到本專案合約。請檢查 MetaMask 的網路設定後，再重新連線。');
  }
}

export async function checkSepoliaGasBalance(signer) {
  const balance = await signer.provider.getBalance(await signer.getAddress(), 'pending').catch(()=>null);
  if (balance===0n) throw new Error('此錢包沒有 Sepolia ETH，請先補足測試網 ETH 再付款');
}

async function previewPaymentFee(signer,address,estimateGas) {
  const {provider}=signer;
  const [balance,feeData]=await Promise.all([
    provider.getBalance(address,'pending').catch(()=>null),
    provider.getFeeData().catch(()=>null),
  ]);
  const maxFeePerGas=feeData?.maxFeePerGas??feeData?.gasPrice;
  if (balance===0n) throw new Error('此錢包沒有 Sepolia ETH，請先補足測試網 ETH 再付款');
  if (balance===null||maxFeePerGas==null||maxFeePerGas===0n) return '';
  let gas;
  try {gas=await estimateGas();}
  catch(error) {
    const code=walletErrorCode(error),nodes=walletErrorNodes(error);
    const reverted=nodes.some(node=>node.code==='CALL_EXCEPTION'&&(node.data!=null||node.revert))
      ||nodes.some(node=>/execution reverted/i.test(node.message||''));
    if(reverted||isInsufficientGasError(nodes)||[4001,4100,'ACTION_REJECTED'].includes(code)) throw error;
    // If an optional preview fails, ethers still estimates gas when preparing the actual transaction.
    return '';
  }
  const estimatedMaxFee=gas*maxFeePerGas;
  if (balance>=estimatedMaxFee) return '';
  return ` 目前 Sepolia ETH 餘額低於估算的網路費上限（${formatEther(estimatedMaxFee)} ETH）。請在 MetaMask 查看費用。`;
}

async function sendEscrowTransaction(send,onSubmitted) {
  let tx;
  try {tx=await send();}
  catch(error) {
    // The RPC can return a hash even when ethers fails to fetch the submitted transaction.
    if (error?.info?.sendTransactionHash) onSubmitted(error.info.sendTransactionHash);
    throw error;
  }
  onSubmitted(tx.hash);
  return tx;
}

export function fundingStatusNotification(status) {
  switch (status) {
    case 'funded': return ['success','SKILL 付款已確認','SKILL 已存入託管合約，完課後會依合約規則結算。'];
    case 'quoted': return ['warning','付款等待確認','平台尚未確認鏈上付款。請先在預約管理同步，避免重複付款。'];
    case 'expired': return ['warning','付款報價已到期','平台已確認此筆報價未完成付款，時段已釋放。'];
    default: return ['success','付款狀態已同步','請至預約管理查看目前的鏈上付款狀態。'];
  }
}

/** Backend-signed quotes are the authority for the SKILL amount, payee and booking. */
export async function fundSkillPayment({signer,payment,signal,onProgress=()=>{},onWalletRequest=()=>{},onSubmitted=()=>{},onReceipt=async()=>{}}) {
  signal?.throwIfAborted();
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
  const sepoliaFeeHelp=' 若 MetaMask 顯示費用超過餘額，可選擇它提供的較低費用選項，或先補足 Sepolia ETH。';
  if (await token.balanceOf(address)<amount) throw new Error('鏈上 SKILL 餘額不足');
  if (await token.allowance(address,payment.escrowAddress)<amount) {
    signal?.throwIfAborted();
    onProgress('正在估算 SKILL 授權的網路費');
    const feeNotice=await previewPaymentFee(signer,address,()=>token.approve.estimateGas(payment.escrowAddress,amount));
    await ensurePaymentNetwork(signer,payment.chainId);
    signal?.throwIfAborted();
    onProgress('請在 MetaMask 授權本筆 SKILL 金額。'+feeNotice+sepoliaFeeHelp);
    onWalletRequest();
    let approvalSubmitted=false;
    try {
      const approval=await sendEscrowTransaction(()=>token.approve(payment.escrowAddress,amount,{chainId:SEPOLIA_CHAIN_ID}),()=>{
        approvalSubmitted=true;
        onProgress('SKILL 授權已送出，等待區塊確認');
      });
      await onReceipt(await waitForPaymentTransaction(approval));
    } catch(error) {
      if(!approvalSubmitted||(error?.code==='TRANSACTION_REPLACED'&&error.cancelled)) throw error;
      throw new Error('SKILL 授權已送出。請先在 MetaMask 確認授權結果，再繼續付款。',{cause:error});
    }
  }
  signal?.throwIfAborted();
  onProgress('正在估算 SKILL 付款的網路費');
  const feeNotice=await previewPaymentFee(signer,address,()=>escrow.fund.estimateGas(payment.quote,payment.signature));
  await ensurePaymentNetwork(signer,payment.chainId);
  signal?.throwIfAborted();
  onProgress('請在 MetaMask 確認付款至託管合約。'+feeNotice+sepoliaFeeHelp);
  onWalletRequest();
  const tx=await sendEscrowTransaction(()=>escrow.fund(payment.quote,payment.signature,{chainId:SEPOLIA_CHAIN_ID}),onSubmitted);
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

export async function changeSkillPayment({signer,payment,action,signal,onSubmitted=()=>{},onReceipt=async()=>{}}) {
  signal?.throwIfAborted();
  if (!['cancel','complete','dispute','refund','claim'].includes(action)) throw new Error('不支援的交易操作');
  await ensurePaymentNetwork(signer,payment.chainId);
  const actor=await signer.getAddress();
  const expected=['refund','claim'].includes(action)?payment.quote.teacher:payment.quote.student;
  if (actor.toLowerCase()!==expected.toLowerCase()) throw new Error('請連接此筆交易原本的收付款錢包');
  const contract=new Contract(payment.escrowAddress,protocol.abi,signer);
  await ensurePaymentNetwork(signer,payment.chainId);
  signal?.throwIfAborted();
  const tx=await sendEscrowTransaction(()=>contract[action](payment.paymentId,{chainId:SEPOLIA_CHAIN_ID}),onSubmitted);
  const receipt=await waitForPaymentTransaction(tx);
  await onReceipt(receipt);
  return receipt;
}
