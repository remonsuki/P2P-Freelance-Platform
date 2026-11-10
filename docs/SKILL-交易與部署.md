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

目前爭議採老師同意全額退款的規則，沒有第三方仲裁或部分退款。此版本只允許 Sepolia（11155111）與本機測試鏈（1337、31337），不接受主網。合約沒有管理者提走託管款項的介面。

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

若要查看這次已完成的本機鏈驗收，請開啟 `.local-backups/chain-test/report.md`。其 Chain ID 為 1337、RPC 為 `http://127.0.0.1:18545`；在錢包頁或預約管理登入任一測試帳號，可看到該帳號的 2 筆 SKILL 課程交易。重新開機後須先在 `blockchain` 執行 `npm run local:node` 啟動原資料鏈。後端 `.env` 目前已指向本機鏈；以下 Sepolia 步驟需改用自己的 RPC，另行部署合約並取得測試幣。

### 1. 確認既有代幣

確認 `0xF3A9Ad79A8bCDF5F58C4d79BADebB3F47715B009` 在你指定的 Sepolia RPC 上確實是 18 位小數、symbol 為 SKILL 的合約。地址格式正確不代表已部署；部署預覽會實際檢查。若地址不對，先用 `file/SkillToken.sol` 部署測試代幣，並在以下設定使用真正地址。

學生錢包需要 SKILL；由代幣持有人轉入，或由代幣合約 owner 呼叫 mint。測試網 ETH 只用於 gas，不能當作 SKILL。

### 2. 建立專用報價簽章金鑰

```powershell
cd D:\二技專題\P2P-Freelance-Platform\blockchain
npm run create-quote-key
```

此工具將金鑰寫入已被 Git 忽略的 `yunbarter-backend/.env.chain.local`，只顯示公鑰地址，不會顯示私鑰，也不會覆寫既有檔案。後端會自動載入這個檔案。將顯示的 `QUOTE_SIGNER_ADDRESS` 填入部署設定。保留並備份此金鑰；合約驗證的報價地址部署後不可變更。

### 3. 設定並預覽部署

```powershell
Copy-Item .env.example .env
```

編輯 `blockchain/.env`：

```dotenv
CHAIN_RPC_URL=你的Sepolia_RPC網址
CHAIN_ID=11155111
SKILL_TOKEN_ADDRESS=已確認的SKILL合約地址
QUOTE_SIGNER_ADDRESS=上一步顯示的公鑰地址
DEPLOYER_PRIVATE_KEY=只用於測試網部署的錢包私鑰
```

請在本機編輯私鑰，不需要貼到聊天。部署錢包需要少量 Sepolia ETH。報價簽章錢包與部署錢包用途不同；報價簽章本身不上鏈，因此不需要 ETH。

```powershell
npm run deploy
```

預設只讀取網路、檢查代幣及列出部署參數，不發送交易。確認參數後才手動執行：

```powershell
npm run deploy -- --send
```

部署成功會顯示 `escrowAddress`，並記錄在 `blockchain/artifacts/deployment-11155111.json`。若流程中斷，先依已顯示的部署交易雜湊確認結果，避免重複部署。

### 4. 啟用後端

在 `yunbarter-backend/.env` 中設定：

```dotenv
CHAIN_ENABLED=true
CHAIN_ID=11155111
CHAIN_RPC_URL=你的Sepolia_RPC網址
CHAIN_CONFIRMATIONS=2
SKILL_TOKEN_ADDRESS=已確認的SKILL合約地址
SKILL_ESCROW_ADDRESS=剛部署的escrowAddress
```

`CHAIN_QUOTE_PRIVATE_KEY` 已由 `.env.chain.local` 提供，不需要再次複製。前端不接觸私鑰，也不用另填合約地址；付款設定由後端 API 提供。先執行 `npm run db:migrate`，再啟動或重啟後端與前端。未啟用時，YTC 可繼續使用，SKILL 選項顯示暫未開放。

有未結束付款時不要更換鏈、代幣、託管合約或報價金鑰；每筆付款保存原合約與錢包快照，必須在原設定下同步。老師與學生的已綁定錢包不能更換；切換 MetaMask 帳戶只會造成錢包不符，不會改寫綁定或交易地址。

### 5. 實際驗收

使用兩個平台帳號與兩個不同錢包，一個學生、一個老師：

- 新帳號註冊時即完成錢包綁定；舊帳號須先在錢包頁補綁一次。老師設定排班並發佈課程。
- 學生選 SKILL，完成授權與付款。在區塊瀏覽器確認代幣進入託管合約，兩邊 YTC 餘額保持不變。
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
- 每次付款同步會補齊該付款全部狀態事件，不會只保留最後一筆。錢包頁同步轉帳與授權，`CHAIN_START_BLOCK` 應設為代幣部署區塊。每次最多掃描 20,000 區塊，可續傳。
- `npm run db:sync-chain` 可補齊既有已結算付款及所有綁定錢包的歷史備份。鏈關閉或 RPC 暫時無法使用時，交易備份仍可查閱。
- 006 遷移保留舊 YTC 流水帳於 `legacy_point_transactions`，舊預約增加 `archived_at`，不再占用可預約時段。移除餘額前可先使用 `pg_dump` 保存舊版資料庫以便還原。

## MetaMask 顯示「請切換至測試鏈 1337」

這表示錢包目前的網路與後端不同。先重新整理前端，前往錢包頁按「新增／切換至交易網路」，並在 MetaMask 確認。付款、退款與完課撥款也會先引導切換，再重新建立 Provider／Signer 並檢查合約；取消切換時不會繼續付款。切換網路不會自動重新整理頁面。

本專案持久化測試鏈的設定：

| 欄位 | 值 |
| --- | --- |
| 網路名稱 | YunBarter 本機測試鏈 1337 |
| RPC | `http://127.0.0.1:18545` |
| Chain ID | `1337`（十六進位 `0x539`） |
| 貨幣符號 | `ETH` |
| 區塊瀏覽器 | 留白 |

若 MetaMask 已有 Chain ID 1337 的網路，請確認 RPC 使用 **18545** 埠；相同 Chain ID 不保證連到同一個本機節點。錢包須使用會員原本綁定的地址。原生貨幣 ETH 支付網路費，SKILL 是另外的課程付款代幣。

後端以 `/api/chain/config` 的 `walletNetwork` 提供錢包設定。本機無帳密的 loopback RPC 會自動提供；遠端 RPC 請另設可公開的 `CHAIN_WALLET_RPC_URL`，不會自動公開後端的私密 RPC URL。修改後端程式或設定後需重啟 API。若重新開機，先於 `blockchain` 執行 `npm run local:node` 啟動原節點，保留原本的 ganache 資料目錄。

## MetaMask 4100／could not coalesce error

4100 表示目前網站尚未取得該帳戶或方法的授權。ethers 可能將它包在 `error`、`info.error` 或 `cause` 內，畫面現在會展開原始錯誤並提供操作指引。

請使用固定的前端網址（例如 `http://localhost:5173`），重新整理後進入錢包頁，按「重新授權綁定錢包」，在 MetaMask 勾選頁面顯示的原綁定地址並確認，再回預約管理操作。網站登入、錢包連線授權與代幣付款授權各有不同用途。

連線程式會以會員綁定地址選擇已授權的 signer，並把同一個連線傳給付款／退款流程；遇到 4100 時，僅在建立連線與讀取合約的階段補做一次帳戶授權。授權被拒或帳戶不符時停止，不能換綁錢包。付款或代幣 approve 遇到 4100 時會顯示重新授權指引，不自動重送交易。
