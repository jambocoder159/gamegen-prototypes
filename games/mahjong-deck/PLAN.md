# Mahjong Deck（麻將牌組）— PLAN.md

> 標記：[事實]／[策略推論]／[待驗證假設]。不含任何市場數字。

## 1. 一句話
在疊成金字塔的麻將牌堆中配對消除，每過一關從三張能力卡中挑一張加進牌組，用卡牌效果撐過五個越來越大的牌堆。

## 2. 目標客群 / 平台
- 客群 [策略推論]：喜歡麻將接龍（Mahjong solitaire）又想要 roguelike 選卡策略的休閒玩家；一局 5–10 分鐘，單手直拿。
- 平台 [事實，依 skill 預設]：HTML ZIP（GameGen），React 19 + TypeScript + Vite，noskin 架構。
- 差異化 [待驗證假設]：把「配對消除」與「每關選卡、能力疊加」結合（類 Slay the Spire 的選卡節奏，但規則簡單）。需上線留存數據驗證。牌面皆為通用圖案（無文字、無真實賭博元素、無下注）。

## 3. 核心循環
點兩張相同且「自由」的牌 → 消除並計分（連續快速配對連擊加倍）→ 清空牌堆過關 → 從 3 張能力卡挑 1 張加入手牌 → 下一關更大 → 5 關全清通關。
- 可點（自由）牌規則：「上方沒被蓋住，且左邊或右邊至少一側沒有緊貼的牌，才能點」。蓋住與相鄰的判定，都以牌實際「畫出來的矩形」為準（共用幾何模組 `src/game/geometry.ts`，邏輯與 BoardView 用同一份），且上層牌需壓到下層牌面積 ≥12% 才算蓋住——所見即所得，不會出現看起來沒蓋到卻不能點的牌。被擋住的牌保持不透明（opacity 1），以 brightness(0.48) 變暗，避免下層圖案透出；自由牌保持明亮。
- 點到被擋住的牌不扣愛心、不選取：牌輕微晃動、播放極輕的 sfx_wrong，並在牌堆旁的 aria-live 區顯示提示（「這張牌被蓋住了」或「左右兩側都被擋住了」）。
- 失誤：點兩張不同的「可點牌」= 失去 1 顆愛心（3 顆起始，上限 5）。愛心歸零 → 本局結束。
- 牌堆保證可解 [實作決定]：以「倒推」生成——每次從目前自由牌中挑兩張指定同花色，直到配完；但玩家的配對順序可能卡死，若無任何可配對，強制「重洗」並扣 1 愛心（有洗牌卡可免扣）。
- 5 關 [實作決定]：牌數 24 / 36 / 48 / 60 / 64，花色種數 6 / 8 / 10 / 12 / 14（16 種花色中取前 N 種，每種數量為偶數），3 層或 4 層金字塔版型各不同（版型集中於 src/game/layouts.ts）。
- 計分：每對 100 × 連擊倍率（2.5 秒內再配對 +1，最高 ×5）；過關加分＝愛心數 × 200 ＋ 剩餘時間無（本作無倒數）。最高分存 localStorage。
- 能力卡（單次消耗品，手牌上限 4 張，同種可疊數量）[實作決定]：
  1. 提示（card_hint）：高亮一組可配對的牌。
  2. 洗牌（card_shuffle）：重新分配剩餘牌的花色（保證至少有可解順序），不扣愛心。
  3. 復原（card_undo）：把最近一次消除的一對放回。
  4. 萬用（card_wild）：下一次配對可與任意一張自由牌配對。
  5. 治癒（card_heal）：點擊恢復 1 顆愛心（上限 5），滿血時不消耗。
  6. 連擊（card_combo）：接下來 3 次配對分數 ×2。
- 起始手牌：提示 ×1、洗牌 ×1。
- 標題畫面：後方由程式自動玩第 1 關（真實遊戲邏輯），logo 在上、「進入遊戲」＋語言在下。

## 4. 版面
- 直式（預設）：頂部 關卡／分數／愛心 pills；中間牌堆（依可用空間等比縮放、置中）；下方手牌（最多 4 張卡，點擊使用，≥44px 觸控）；最底按鈕列（重開、音效、語言）。發牌員吉祥物保留於標題與結果／選卡畫面，遊戲內空間用於教學及大尺寸操作按鈕。
- 橫式 16:9／近方形：牌堆置中偏左，右側直排 pills、手牌與按鈕；按鈕不落在畫面正中線上。
- 選卡畫面：三張卡橫排（窄螢幕可換行），點選後確認進下一關。

## 5. 素材清單（GPT 生圖，風格：光澤粗線 Q 版、深綠牌桌）
| 檔名 | 用途 |
|---|---|
| icon_tile_bamboo/dots/coin/koi/peach/plum/orchid/lantern/fan/crane/pagoda/moon/sun/tea/dragon/cat.png | 16 種牌（已含牌厚度邊） |
| card_hint/shuffle/undo/wild/heal/combo.png | 6 張能力卡（無文字，名稱與說明由語系檔以 HTML 文字呈現） |
| panel_pill_felt.png / panel_pill_gold.png | pill 與按鈕底 |
| icon_heart / icon_star / icon_restart / icon_sound_on / icon_sound_off / icon_language.png | 圖示 |
| seq_dealer_deal_1~4.png | 發牌員（紅貓熊）動畫：待機／壓低／拋牌歡呼／眨眼 |
| logo_base.png、bg_base.webp、bg_portrait.webp、poster.png | 標題徽章、牌桌背景、封面 |
| audio：sfx_select/match/wrong/card/clear/win/lose/click/hover、bgm_base | 自製合成（AUDIO_NOTES.md，待人耳挑選） |

## 6. 合規檢查
React 19 + TS；資產位置、四語、固定 relativePath 表、解析順序、載入畫面＋手勢解鎖音訊、直式優先與摺疊機重排、prefers-reduced-motion、WCAG 2.2 AA 基本項（每張牌為 button，aria-label 含花色與是否自由；鍵盤方向鍵移動、Enter 選取、1–4 用卡、Z 復原卡）。無第三方 IP、無真錢、無下注、無追蹤。若日後上 App Store：模擬賭博類別需再審（麻將牌元素但無下注，預期不適用）[待驗證假設，以問卷為準]。

## 7. 上架缺口（需要 Jambo / 帳號）
GameGen 後台上傳權限與審核；音效人耳驗收；實機驗證；關卡難度與卡牌平衡人手試玩調整。

## 8. Playtest fixes (October 2026)

- First-run coach: three non-blocking steps (select / match / card), localized in
  en / zh-tw / zh-cn / ja, skip and reopen with ?. Uses existing tile/card art.
- Browser-language detection honors supported preferences in order; manually
  saved language takes priority. Run persistence is separate from best score,
  versioned and field-validated, with action saves and lifecycle flushes. A title
  Continue button resumes it. Timed speed combo resets after reload; consumable
  card charges, hints, selected tile, reward phase and undo history survive.
- Runs get a random uint32 seed. The same seed gives reproducible stage/reward/
  shuffle choices; reverse-play construction guarantees a solution. Automated
  verification uses production code (no mirrored generator/layout definitions),
  256 independently solved random stage-1 seeds and 200 legal solutions per stage.
- HUD labels >=18px, values >=22px, hearts 28px, icon controls 48px. Title art and
  copy occupy separate flex/grid cells, checked for intersecting bounding boxes.

### Stage 5 balance method

[Implementation decision] Stage 5 changes from 72 tiles (32+18+14+8) to 64
(32+16+10+6), retaining four layers and 14 faces. Entering it replenishes hearts
to at least 3 (never reduces higher health); the stage-4 reward explains this.
The reduced overlap makes the exposed faces easier to read, especially on phones.

[Simulation, not a measured human win rate] The test models a novice who sees
all currently legal matches and chooses uniformly among them, with no lookahead.
On each matching opportunity, when different free faces exist, a 5% error chance
costs a heart; otherwise a random legal pair clears. A stuck board costs one heart
and uses the actual seeded reverse-solvable reshuffle. The cohort enters with 3
hearts and no unused survival cards (Hint/score cards do not change survival).
Extra held cards or fewer errors can improve results; this is a stated proxy for
a reasonable new player, not a population claim.

The comparison uses run seeds 1–1000 and policy PRNG `mulberry32(seed ^ 0xabc987)`.
Both initial deals and reshuffles use the production `dealSeed` and actual stage
geometry. With the old 72-tile layout and the same 3 entry hearts, 415/1000 trials won
(41.5%), with 984 stuck-board events. The final layout wins 595/1000 (59.5%),
with 669 stuck-board events. Before the recovery rule a player could enter with
only one or two hearts; the new minimum eliminates that large entry disadvantage.
`test:logic` asserts the final win rate remains between 40% and 60%, the finale
has 64 tiles and 14 faces, and the browser test checks recovery from one heart to
three on entry and wins stage 5 using real tile buttons.
