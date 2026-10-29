# Shelf Sort（貨架理貨）— PLAN.md

> 標記：[事實]＝來自 skill／已驗證；[策略推論]＝企劃判斷；[待驗證假設]＝需上線數據或 Jambo 決定。不含任何市場數字。

## 1. 一句話
把亂七八糟擺在貨櫃倉庫貨架上的商品，一件件搬到空位，讓每一層貨架擺滿 3 件相同商品，全部理好就過關。

## 2. 目標客群 / 平台
- 客群 [策略推論]：喜歡「整理、分類」療癒感與短關卡益智的休閒手機玩家；單手直拿，一關 30 秒–2 分鐘。
- 平台 [事實，依 skill 預設]：HTML ZIP（GameGen），React 19 + TypeScript + Vite，noskin 架構。
- 差異化 [待驗證假設]：「分類整理」是成熟玩法；差異在貨櫃倉庫主題、店員貓吉祥物、無限復原、確定可解的關卡。需上線後留存／分享數據驗證。

## 3. 核心循環
點一件商品（抬起）→ 點任一空位（可在同層或別層）放下 → 某層 3 件相同 → 清除（閃光＋店員歡呼）→ 全部清除過關 → 星等（依步數對比解答步數）→ 下一關。
- 規則：每層 3 格。關卡有 K 種商品各 3 件，S 層貨架（S>K，空位 = 3(S−K)）。
- 關卡 [實作決定]：共 12 關，可由種子產生、必經求解器驗證可解（`src/game/logic.ts`，UI／標題 AI／無頭測試共用）。K 由 3 增至 7、S=K+1 或 K+2 漸增難度。
- 星等：步數 ≤ 解答步數×1.0 → 3 星；≤ ×1.5 → 2 星；其他 1 星 [實作決定]。
- 功能：無限復原、重開、關卡選擇（已解鎖者）、音效開關、語言。
- 進度（已解鎖關卡、各關最佳星數）存 localStorage（白名單驗證）。

## 4. 版面
- 直式（預設）：頂部關卡／步數 pill（panel_pill），中間貨架直排（每層用 panel_shelf），底部按鈕列（復原、重開、選關、音效、語言）；店員貓在下方空處歡呼。
- 橫式 16:9 與近方形：貨架以 2 欄排列置中偏左，右側為資訊與按鈕直排；按鈕不在中線。
- 標題畫面：後方由求解器自動播放真實關卡（一步步搬商品）、logo 在上、「進入遊戲」＋語言在下；音訊未解鎖前靜音。

## 5. 素材清單（GPT 生圖，風格：圓潤向量角色，單色填色、薄深青描邊、豆豆眼）
| 檔名 | 用途 |
|---|---|
| icon_goods_milk/soda/cereal/jam/tuna/juice/chips/soap.png | 8 種商品 |
| panel_shelf.png | 單層貨架（3 格站在木板上；格位由程式均分） |
| panel_pill_teal.png / panel_pill_orange.png | 資訊 pill、主要按鈕底 |
| icon_restart/undo/sound_on/sound_off/language/star.png | 按鈕與星等 |
| logo_base.png | 標題徽章（文字由語系檔以 HTML 文字呈現） |
| seq_clerk_cheer_1~4.png | 店員貓動畫（待機 / 彎腰 / 舉箱歡呼 / 眨眼），標題、清層、過關使用 |
| bg_base.webp / bg_portrait.webp | 16:9 / 9:16 貨櫃倉庫背景 |
| poster.png | 平台封面 9:16 |
| audio：sfx_pick/place/clear/win/nope/click/hover、bgm_base | 自製合成（見 AUDIO_NOTES.md，待人耳挑選） |

## 6. 合規檢查（對照 game-platform-standard §8）
- React 19 + TS；資產在 public/common/textures、audio；語系 public/config/language（en / zh-TW / zh-CN / ja，預設 en）。
- 固定 relativePath 表；資源解析 style → commonPath → /common/ → /；單一資源失敗不白屏。
- 載入畫面＋真實進度＋「進入遊戲」手勢解鎖音訊。
- HTML ZIP 根目錄 index.html + poster.png；Asset Naming Rule V2。
- 品質：直式版面、摺疊機重排、prefers-reduced-motion、WCAG 2.2 AA 基本項（對比、鍵盤可操作［方向鍵移動焦點、Enter 選取］、焦點可見、aria-live、觸控目標≥44px、lang 屬性）。
- 無第三方 IP、無真錢、無追蹤。商品圖為通用圖案，無文字與品牌。

## 7. 上架缺口（需要 Jambo / 帳號）
GameGen 後台上傳權限與審核；音效人耳驗收；實機驗證（手機／摺疊機）；關卡難度人手試玩調整。
