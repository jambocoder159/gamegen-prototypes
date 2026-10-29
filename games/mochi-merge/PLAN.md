# Mochi Merge（麻糬合成）— PLAN.md

> 狀態標記：[事實]＝來自 skill／已驗證；[策略推論]＝企劃判斷；[待驗證假設]＝需上線後數據或 Jambo 決定。本文件不含任何市場數字（沒有可查證來源，不捏造）。

## 1. 一句話
滑動整個 4×4 盤面，讓同階麻糬撞在一起合成下一階，從白麻糬一路合到金龍麻糬。

## 2. 目標客群 / 平台
- 客群 [策略推論]：在動態牆滑手機的休閒玩家，單手直拿、一局 2–5 分鐘；偏好「可愛＋輕鬆益智」。
- 發布方式 [事實，依 skill 預設]：HTML ZIP 直接上傳 GameGen（社群分享用、非商用），React 19 + TypeScript + Vite，noskin 架構。
- 上 App Store 為選配（見 §7），本版不主打。
- 差異化 [待驗證假設]：滑動合成是成熟玩法；差異在「9 階麻糬進化＋金龍終局」與完整直式優先體驗。需用留存/分享數據驗證。

## 3. 核心循環
滑動(上/下/左/右，或觸控滑動) → 同階相鄰麻糬合成＋得分 → 空格生成新麻糬(1 階 90% / 2 階 10%) → 盤面滿且無可合併 → 結算 → 再玩一次。
- 計分 [實作決定]：合成出第 n 階得 `2^n` 分（第 2 階 4 分 … 第 9 階 512 分）。規則與隨機數集中於可給定種子的 `src/game/logic.ts`，供 UI、標題 AI、無頭測試共用。
- 勝利：合出第 9 階「金龍麻糬」彈出慶祝，可選擇「繼續」刷分（不強制結束）。
- 每次有效移動即儲存版本化棋盤、分數、最高分、亂數狀態、方塊 ID、移動次數與繼續遊戲旗標；另於 pagehide / visibilitychange 儲存。逐欄位驗證、限制大小，壞資料安全重設。標題提供「繼續遊戲／新遊戲」；結束或達成金龍時清除，選擇繼續後重新儲存。
- 操作：鍵盤方向鍵／WASD、觸控滑動；螢幕按鈕（重玩、音效、語言）。不做復原（保持範圍小）。

## 4. 版面
- 直式（預設）：上方分數／最高分（pill 底板）、中間 4×4 盤面、下方按鈕列；盤面以螢幕寬為準放大。
- 橫式 16:9 與近方形（摺疊機）：盤面置中偏左、資訊與按鈕靠右側直排，按鈕不在畫面正中線上。
- 標題畫面：背後由電腦自己玩（真實遊戲邏輯隨機/貪婪 AI 滑動）；圖與標題文字分開排列。載入完成直接顯示標題，只有「開始／繼續遊戲」按鈕解鎖音訊，移除額外「進入遊戲」層。短橫式左右分欄。
- 首次遊戲顯示不遮住棋盤的兩步教學：移動→同數字合成；操作後自動前進，可略過並以「?」重開，四語同步。
- HUD 標籤至少 18px、分數 28px、按鈕至少 48×48；金龍圖示＋四語目標與目前最高階／第 9 階進度。每塊麻糬保留原圖並加上高對比階級數字。
- 結算顯示本局最高階的名稱、數字、對應圖示與最高分。

## 5. 素材清單（全部 GPT 生圖，風格：益智遊戲簡潔角色 #149）
| 檔名 | 用途 |
|---|---|
| icon_mochi_plain/sakura/matcha/bean/strawberry/mango/taro/star/dragon.png | 1–9 階方塊 |
| panel_board.png / panel_cell.png | 盤面外框／空格底 |
| panel_pill_pink.png / panel_pill_mint.png | 分數 / 最高分底板、按鈕底板 |
| icon_restart/sound_on/sound_off/language.png | 控制按鈕 |
| logo_base.png | 標題徽章（文字由語系檔以 HTML 文字呈現） |
| bg_base.webp / bg_portrait.webp | 16:9 / 9:16 背景 |
| poster.png | 平台動態封面（9:16） |
| audio：sfx_move/merge/win/over/click/hover、bgm_base | 自製合成（見 AUDIO_NOTES.md，待人耳挑選）。sfx_spawn 已移除：生成麻糬不發音（zero-residue，檔案已刪） |

## 6. 合規檢查（對照 game-platform-standard §8）
- React 19 + TS、build 無錯誤；資產在 public/common/textures、audio；語系在 public/config/language（en / zh-TW / zh-CN / ja，預設跟隨瀏覽器，已儲存選擇優先，無對應語言時 en）。
- 固定 relativePath 表；資源解析順序 style → commonPath → /common/ → /；單一資源失敗不白屏。
- 載入畫面顯示真實進度，完成後自動進標題；「開始／繼續遊戲」手勢解鎖音訊。
- Asset Naming Rule V2；HTML ZIP 根目錄 index.html + poster.png。
- 品質：直式版面、摺疊機重排、prefers-reduced-motion、WCAG 2.2 AA 基本項（對比、鍵盤可操作、焦點可見、aria-live 分數、觸控目標≥48px、語言屬性）。
- 為社群分享；無第三方 IP、無真錢。若日後上 App Store：模擬賭博不適用（無下注）、無追蹤、無內購，年齡分級預期 4+ [待驗證假設，以問卷為準]。

## 7. 上架缺口（需要 Jambo / 帳號）
GameGen 後台上傳權限與審核；音效人耳驗收；實機（iPhone Duo / 手機）驗證；是否做 App Store。
