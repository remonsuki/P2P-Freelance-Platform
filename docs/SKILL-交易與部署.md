# SKILL 鏈上交易與部署

所有新付款、託管、撥款及退款統一使用 SKILL ERC-20 合約。前端直接向錢包 Provider 讀取 SKILL／ETH，保留字串小數精度，不將餘額傳回資料庫。資料庫儲存課程成交金額、預約及已查驗的交易備份。舊 YTC 交易與預約保留為封存歷史，不換算成 SKILL。

## 已實作的流程

1. 新帳號註冊時會先要求 MetaMask 連線，並簽署短效、一次性的綁定訊息，再一起建立帳號與永久錢包綁定。舊帳號若尚未綁定，可登入後在錢包頁補綁一次；一個帳號只能有一個錢包，同一錢包只能屬於一個帳號，不能更換或解除。
2. 學生選擇課程與時段，使用 SKILL 付款。後端以資料庫中的課程價格、已驗證錢包及時段產生 EIP-712 簽章報價，保留時段最多約 10 分鐘。
3. MetaMask 授權本筆 SKILL 金額，再付款至 `SkillEscrow`；原本充足的 allowance 可省去授權交易。部署、授權、付款及結算均需要測試網 ETH 支付 gas。
4. 後端透過自己的 RPC 查驗合約儲存狀態、完整報價內容、合約事件與成功收據，等待設定的確認深度後才建立或更新預約。前端不能只交一個 txHash 就宣告付款成功。
5. 學生課前可取消並全額退款；課程結束後可確認完課，合約將 SKILL 撥至報價中的老師錢包，再由平台儲存評價。
6. 開課後、完課後 7 天內，學生可提出鏈上爭議，凍結撥款。老師可同意全額退款。爭議一旦成立，7 天後也不會自動撥款。
7. 沒有爭議、學生也未確認完課時，老師可在完課後 7 天領取款項。

目前爭議由老師同意全額退款。平台的新交易使用 Ethereum Sepolia（`11155111`），自動化測試使用獨立的 Ganache 鏈。

## 安裝與驗證

需要 Node.js 24、PostgreSQL，以及前後端依賴。需套用至 `db/migrations/006_chain_only_transactions.sql`，已有資料庫也需要執行遷移。錢包綁定不依賴鏈上交易啟用或 RPC：

```powershell
cd D:\二技專題\P2P-Freelance-Platform\blockchain
npm ci
npm run compile
npm test

cd ..\yunbarter-backend
npm ci
npm run db:migrate
npm test
npm run test:integration

cd ..\yunbarter-app
npm ci
npm run lint
npm run build
```

整合測試需可連線 PostgreSQL，可用 `TEST_DATABASE_URL` 指定測試連線。測試會建立並移除隨機命名的 schema，並在程式內啟動的本機 Ganache 測試鏈部署合約，不使用你的 Sepolia 資產。Ganache 在 Node.js 24 可能提示 µWS 原生模組不相容，會改用 Node.js 實作；不影響測試功能。

## 部署至 Sepolia

從 Ganache 切換前，先在原網路同步並結清所有待付款、託管中或爭議中的交易。已結算的舊付款及收據會保留原 Chain ID，可在預約管理及錢包頁查閱。切到 Sepolia 後，會員使用原綁定錢包地址，餘額及新交易均以 Sepolia 為準。

### 1. 確認既有代幣

沿用 Sepolia 上的 18 位小數 SKILL 代幣 `0xF3A9Ad79A8bCDF5F58C4d79BADebB3F47715B009`。部署預覽會再次向設定的 RPC 查驗網路、合約、代幣代號和小數位數。若已有相容的 SkillEscrow，可驗證它的代幣及報價簽章地址後直接設定後端。

學生錢包需要 SKILL，可由代幣持有人轉入，或由代幣合約 owner 呼叫 `mint`。每個會送出鏈上操作的錢包也需要 Sepolia ETH 支付網路費，可從 [Ethereum 官方文件列出的 Sepolia 水龍頭](https://ethereum.org/developers/docs/networks/#sepolia)取得。

### 2. 建立專用報價簽章金鑰

```powershell
cd D:\二技專題\P2P-Freelance-Platform\blockchain
npm run create-quote-key
```

若已有 `yunbarter-backend/.env.chain.local`，使用原本的金鑰，此指令只用於初次建立。工具會顯示公開的 `QUOTE_SIGNER_ADDRESS`，請填入部署設定。後端自動載入此檔案，部署後合約固定使用這個簽章地址。

### 3. 設定並預覽部署

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

編輯 `blockchain/.env`：

```dotenv
CHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CHAIN_ID=11155111
SKILL_TOKEN_ADDRESS=0xF3A9Ad79A8bCDF5F58C4d79BADebB3F47715B009
QUOTE_SIGNER_ADDRESS=上一步顯示的公鑰地址
DEPLOYER_PRIVATE_KEY=只用於測試網部署的錢包私鑰
```

請把專用測試部署錢包的私鑰填在本機的 `blockchain/.env`，並在該錢包備妥 Sepolia ETH。報價簽章錢包負責在後端簽發報價，部署錢包負責付部署費。

```powershell
npm run deploy
```

預設只讀取網路、檢查代幣及列出部署參數，不發送交易。確認參數後才手動執行：

```powershell
npm run deploy -- --send
```

部署成功會將 `escrowAddress` 和交易雜湊寫入 `blockchain/artifacts/deployment-11155111.json`。請在 Etherscan 或 RPC 收據查閱部署區塊。若流程中斷，先依已顯示的交易雜湊確認結果。

### 4. 啟用後端

在 `yunbarter-backend/.env` 中設定：

```dotenv
CHAIN_ENABLED=true
CHAIN_ID=11155111
CHAIN_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CHAIN_WALLET_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CHAIN_CONFIRMATIONS=2
CHAIN_START_BLOCK=託管合約部署區塊
SKILL_TOKEN_ADDRESS=0xF3A9Ad79A8bCDF5F58C4d79BADebB3F47715B009
SKILL_ESCROW_ADDRESS=已查驗的託管合約地址
```

`CHAIN_QUOTE_PRIVATE_KEY` 由 `.env.chain.local` 提供。先執行 `npm run db:migrate`，再啟動或重啟後端。用 `GET /api/chain/config` 檢查回傳的 `enabled: true`、`chainId: 11155111` 和託管地址。準備期間設定 `CHAIN_ENABLED=false`，付款會暫停。舊 YTC 只供查閱，原點數交易 API 回傳 `410`。

有未結束付款時不要更換鏈、代幣、託管合約或報價金鑰；每筆付款保存原合約與錢包快照，必須在原設定下同步。老師與學生的已綁定錢包不能更換；切換 MetaMask 帳戶只會造成錢包不符，不會改寫綁定或交易地址。

### 5. 實際驗收

使用兩個平台帳號與兩個不同錢包，一個學生、一個老師：

- 新帳號註冊時即完成錢包綁定；舊帳號須先在錢包頁補綁一次。老師設定排班並發佈課程。
- 學生使用 SKILL 授權及付款。確認 Sepolia 的代幣轉入託管合約，等到設定的確認數後，預約管理顯示「SKILL 託管中」。
- 在「預約管理」同步付款，測試課前取消，SKILL 應回到原學生錢包。
- 另建預約，等課程結束後由學生完課，SKILL 應轉入原老師錢包。
- 測試提出爭議、老師同意退款，以及多次按同步時不會重複結算。

## 交易中斷時

每筆報價在開啟錢包前已存入資料庫。「預約管理 → SKILL 鏈上交易」提供待付款、同步、交易瀏覽器連結與繼續付款。

- 拒絕授權／付款：尚未入託管的 SKILL 不會被扣除；已成功的 approve 可能留下該筆金額的 allowance，並已支付該次 gas。可以繼續付款，或等待報價到期。
- 付款已送出但網站逾時／重新整理：先按同步。前端重試會先讀合約，已付款的編號不會再次扣款；合約本身也拒絕重複付款。
- 報價過期：後端需確認「足夠深度的鏈上區塊時間已過報價期限，且合約沒有該筆付款」後才釋放時段；瀏覽器時間不會直接釋放。
- 後端離線時完成付款／退款：恢復後，載入交易列表或按同步即可補回。同步不需要學生再次付款。
- RPC 失敗：保持時段與原狀態，顯示同步失敗，不猜測付款成功／失敗。課程列表和交易列表的讀取會嘗試補同步；目前沒有獨立常駐鏈上事件監聽服務。
- 超過確認深度的鏈重組：此測試版需要人工核對；2 個確認不等於 Ethereum 最終確定性。

合約來源：`blockchain/contracts/SkillEscrow.sol`。共用 EIP-712 型別與 ABI：`blockchain/protocol.json`。報價與鏈上驗證：`yunbarter-backend/chain.js`。

合約使用 OpenZeppelin 的 [EIP-712 與 ECDSA](https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography)、[SafeERC20](https://docs.openzeppelin.com/contracts/5.x/api/token/erc20)，收據查驗使用 [ethers Provider](https://docs.ethers.org/v6/api/providers/)。

## 資料庫備份規則

- `users` 不含 `cached_points` 或其他剩餘金額欄位。課程價格與每筆成交金額仍需保存。
- `chain_transaction_records` 以 `(chain_id, tx_hash)` 唯一儲存區塊號、區塊雜湊、時間、發送與接收地址、交易結果、ERC-20 Transfer／Approval、Gas 用量及費用、完整交易與收據 JSON。
- 後端只信任設定的 RPC／代幣／託管合約，達到 `CHAIN_CONFIRMATIONS` 並核對正式區塊雜湊後才備份；重複同步不會新增重複紀錄。
- 每次付款同步會補齊該付款的全部狀態事件。錢包頁從 `CHAIN_START_BLOCK` 開始同步轉帳及授權。可使用託管部署區塊，或指定更早的區塊帶入既有代幣歷史。每次最多掃描 20,000 區塊，可續傳。
- `npm run db:sync-chain` 可補齊既有已結算付款及所有綁定錢包的歷史備份。鏈關閉或 RPC 暫時無法使用時，交易備份仍可查閱。
- 006 遷移保留舊 YTC 流水帳於 `legacy_point_transactions`，舊預約增加 `archived_at`，不再占用可預約時段。移除餘額前可先使用 `pg_dump` 保存舊版資料庫以便還原。

## MetaMask 切換到 Sepolia

在錢包頁按「新增／切換至交易網路」，並在 MetaMask 使用會員原綁定的地址確認。付款、退款與完課撥款也會引導切換並重新建立錢包連線。

| 欄位 | 值 |
| --- | --- |
| 網路名稱 | Ethereum Sepolia |
| RPC | `https://ethereum-sepolia-rpc.publicnode.com` |
| Chain ID | `11155111`（十六進位 `0xaa36a7`） |
| 貨幣符號 | `ETH` |
| 區塊瀏覽器 | [Sepolia Etherscan](https://sepolia.etherscan.io/) |

後端以 `/api/chain/config` 的 `walletNetwork` 提供錢包設定。`CHAIN_WALLET_RPC_URL` 使用可公開的 RPC，服務端私密 RPC 請填在 `CHAIN_RPC_URL`。修改設定後重啟 API。

## MetaMask 4100／could not coalesce error

4100 表示目前網站尚未取得該帳戶或方法的授權。ethers 可能將它包在 `error`、`info.error` 或 `cause` 內，畫面現在會展開原始錯誤並提供操作指引。

請使用固定的前端網址（例如 `http://localhost:5173`），重新整理後進入錢包頁，按「重新授權綁定錢包」，在 MetaMask 勾選頁面顯示的原綁定地址並確認，再回預約管理操作。網站登入、錢包連線授權與代幣付款授權各有不同用途。

連線程式會以會員綁定地址選擇已授權的 signer，並把同一個連線傳給付款／退款流程；遇到 4100 時，僅在建立連線與讀取合約的階段補做一次帳戶授權。授權被拒或帳戶不符時停止，不能換綁錢包。付款或代幣 approve 遇到 4100 時會顯示重新授權指引，不自動重送交易。
