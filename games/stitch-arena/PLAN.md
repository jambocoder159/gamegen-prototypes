# 縫偶擂台 Stitch Arena — PLAN（id: `stitch-arena`，port 4228）

> 狀態標籤：【外部公開宣稱】來自 Poki 頁面與公開介紹文字；【策略推論】我們的設計取捨；【待驗證】需真人試玩確認。

## 0. 研究：參考作品《Magic Battleground》（vessel / Poki）
來源（只讀公開頁面，未實際遊玩）：poki.com/zh/g/magic-battleground 及數個轉載介紹頁。
- 【外部公開宣稱】類型：格鬥遊戲。操控「布偶（ragdoll）戰士」在神秘競技場移動、出拳、施放元素法術、躲避攻擊，把對手巫師「擊出場外」獲勝。
- 【外部公開宣稱】操作：WASD／方向鍵移動；X、Y、Z 或滑鼠左／右鍵出招。每個角色有各自技能（轉載頁稱三種技能＋冷卻）。電腦、手機、平板皆可玩。
- 【外部公開宣稱】進程：多個角色（各有獨特能力）、多個含環境機關的競技場、一場接一場的戰鬥，難度逐步上升；回合短、節奏快、物理混亂感。
- 【策略推論】核心樂趣＝「走位＋近戰＋遠程法術＋把人打飛出場」的短局對戰，物理搖晃造成的喜感與一局一局的「再來一場」。
- 我們保留的是**類型機制**（擂台擊飛制、方向鍵＋三個攻擊鍵＋滑鼠、角色各有技能、場地機關、逐場升難度），**不複製**其名稱、角色、美術、文字、音效、商標、關卡配置。

## 1. 原創設計與差異（務必對外強調）
| 面向 | 參考作品（公開宣稱） | 縫偶擂台（原創） |
|---|---|---|
| 世界觀／美術 | 3D 感布偶巫師、魔法競技場 | **平面毛氈布貼**（畫風圖鑑 #197）縫線布偶法師，四位原創角色：焰狐 Ember、霜兔 Frost、風鴉 Gale、符熊 Rune；三個原創場地：縫花草原、燈籠夜市、冰霜斷崖 |
| 擊飛規則 | 以物理布偶碰撞擊飛 | **「綻線 Fray %」**：被打越多、綻線越高、被擊飛越遠；超出場地邊界失去 1 個「鈕扣」（3 顆鈕扣＝3 條命） |
| 第三技能 | 角色專屬技能 | 全角色共通的 **「縫線鉤 Thread Hook」**：面對對手時把人拉近；在空中掉出台外時鉤住最近的平台邊緣把自己拉回（回場救援），冷卻 2.5 秒 |
| 道具 | 未見公開描述 | **線軸 Spool**：隨機掉落，撿到得到「針線護盾」吸收下一擊並補滿技能冷卻 |
| 場地機關 | 環境機關 | 縫花草原：會左右移動的小平台；燈籠夜市：巨大剪刀預警後落下剪人；冰霜斷崖：地面更滑＋60 秒後「拆線」使主平台從兩側縮短（突然死亡） |
| 進程 | 一場接一場 | **補丁盃 Patch Cup**：6 場連戰（AI 等級 1→6、場地輪替、對手輪替），贏得第 2、4 場分別解鎖風鴉、符熊；另有自選的「快速對決」。可中途存檔、可續戰 |
| 操作 | WASD/方向鍵＋X Y Z／滑鼠 | 方向鍵或 WASD 移動，**Z/J＝出拳、X/K＝法術、C/L＝縫線鉤**，滑鼠左鍵＝出拳、右鍵＝法術；手機橫向使用左搖桿＋右側四顆動作鈕；↑/↓ 可改變法術角度（斜上／斜下） |
| 文字／音效 | — | 全部原創：四語 UI 文字、程式合成的毛線／木琴／卡林巴風格音效與 BGM（`_tools/audio_gen.py` game8） |

## 2. 核心循環
選角（補丁盃只在開局選一次，快速對決每場選）→ 3-2-1-Go → 1 對 1 擂台戰（3 顆鈕扣，120 秒）→ 擊出場外 → 勝負結算 → 補丁盃下一場／解鎖通知／獎盃。

## 3. 規則與數值（皆放 `src/game/config.ts`，可由 `npm run test:sim` 調整後寫回 §8）
### 3.1 世界與物理（固定步長 1/60 秒，純函式模擬，種子式 RNG 可注入，渲染與模擬分離）
- 世界座標 1600×900（y 向下）。擊飛邊界（blast zone）x∈[−250,1850]、y∈[−400,1150]；出界即 KO。
- 重力 2400 u/s²，最大下落 1500；水平最大速度（角色表）；地面摩擦／空中控制；單向平台（可從下方跳上、按住 ↓ 穿下）。
- 角色：站姿受擊框 56×104（以腳底中心為錨點）。跳躍＋二段跳。受擊後進入「受擊硬直」，硬直時間隨擊飛力量增長（0.15–0.6 秒），期間不可行動；速度夠大時用 tumble 圖並旋轉。
- 擊飛：`knock = (base + fray × scale) × weightFactor`；`fray` 每次受傷增加（上限 300%）。角色重量不同（符熊最重）。方向＝攻擊方向＋輕微向上。
- 重生：KO 後 1.5 秒在主平台上空重生，2 秒無敵（閃爍）；fray 歸零。

### 3.2 招式（每個角色三招＋跳躍；冷卻、傷害、擊飛都在 config）
共通：**出拳**（Z/J／滑鼠左）近距離、快速、冷卻 0.35 秒、傷害 6、↑ 出拳＝向上擊飛、↓＝向下（空中可 spike）。**縫線鉤**（C/L）見上。
| 角色 | 定位 | 移速／跳／重量 | 法術（X/K／滑鼠右） | 被動 |
|---|---|---|---|---|
| 焰狐 Ember | 均衡進攻 | 360／960／1.0 | 火球：直線 720 u/s、傷害 9、附「灼燒」2 秒共 +4% 綻線；冷卻 1.2 秒 | 火球可與對方火球／冰箭互相抵消 |
| 霜兔 Frost | 控場 | 380／980／0.9 | 冰箭：直線 900 u/s、傷害 6，命中「冰凍減速」1.5 秒（移速 −40%）；冷卻 1.0 秒 | 站在冰霜場地不打滑 |
| 風鴉 Gale | 機動 | 400／920／0.8 | 風旋：慢速 520 u/s、傷害 3，但橫向擊飛特強（把人推出台）；冷卻 1.4 秒 | 多一段空中滑翔（按住跳躍減緩下落） |
| 符熊 Rune | 重量級 | 320／900／1.25 | 符文岩：拋物線落下、傷害 12、擊飛大、落地震波；冷卻 1.8 秒 | 受擊飛減 20%、不會被冰凍減速 |
- ↑/↓ 搭配法術：直線／斜上 45°／斜下 45°（符文岩改變拋射角）。
- 縫線鉤：射程 420；面向對手（±30°）在射程內 → 對手被拉到面前並受 4 傷害、短暫硬直；否則若自己在空中且附近有平台邊緣（射程內）→ 把自己拉到邊緣上；兩者皆無 → 空揮（冷卻縮短為 1 秒，懲罰）。冷卻 2.5 秒。
- **線軸**：每 12–18 秒在隨機平台上出現 1 個、停留 10 秒；觸碰得到「針線護盾 6 秒」（吸收下一次傷害；顯示 fx_shield）並補滿所有冷卻。
- **剪刀**（燈籠夜市）：每 6–9 秒選一個落點，地面顯示 1 秒預警（閃爍剪刀影），之後落下：命中範圍 120 寬、傷害 10、強力向上擊飛。

### 3.3 場地（背景 `bg_*.webp`，平台圖 `plat_*`；平台頂面碰撞線在圖片上緣下 `surfaceInset`）
| 場地 | 主平台（頂面） | 小平台（單向） | 機關 |
|---|---|---|---|
| 縫花草原 meadow | x 440–1160、y 620 | 2 個，y 430，x 中心 560／1040 各以 ±120、週期 6 秒左右擺動 | 無 |
| 燈籠夜市 lantern | x 400–1200、y 640 | 1 個，y 420，x 800 | 剪刀 |
| 冰霜斷崖 ice | x 520–1080、y 620，摩擦 ×0.4 | 2 個，y 440，x 420／1180 | 60 秒起「拆線」：主平台兩側各以 30 u/s 內縮，最小寬 300；擂台上方開始飄雪（純視覺） |
- 時間到（120 秒）：鈕扣多者勝；同鈕扣比綻線低者勝；再同則 sudden death（綻線 +200 起算，下一次 KO 決勝）。

### 3.4 AI（`src/game/ai.ts`，可注入種子）
- 等級 1–6：反應延遲 0.55→0.12 秒、法術命中預判、使用鉤的機率、掉出台外時的救援成功率（30%→95%）、攻擊頻率與走位積極度；有刻意失誤。AI 與玩家走**同一套輸入指令**（只用 move/jump/punch/spell/hook/down/up）。
- 行為：靠近→保持間距→法術（對齊 y 時）→近身出拳；被擊飛後優先回台（二段跳、鉤）；躲法術（跳）；不蠢到自己掉下去，但有失誤率。
- 補丁盃 6 場：L1 草原、L2 夜市、L3 冰崖、L4 草原、L5 夜市、L6 冰崖；對手角色輪替且不同於玩家。第 2 場勝解鎖風鴉，第 4 場勝解鎖符熊；完賽得獎盃（存檔 `cupDone`）。

## 4. 操作
- 鍵盤：移動 A/D／←→；跳 W／↑／Space；穿下平台 S／↓；出拳 Z／J；法術 X／K；縫線鉤 C／L；暫停 P／Esc。↑/↓ 與法術同按＝改角度。
- 滑鼠：左鍵＝出拳、右鍵＝法術（關閉 contextmenu），面向由移動方向決定；
- 觸控：**橫向遊玩**。左側浮動搖桿有可見待機底座，≥140px 觸控區；第一指捕捉指標、移動起點在區內浮動，18% 水平死區，左右移動、下推穿過平台並向下瞄準、上推只向上瞄準（不跳）。右側四顆真 `<button>` 排成菱形：上方法術、左出拳、右縫線鉤、下方最大跳躍；一般 72px、跳躍 80px，間距 ≥10px。各指分開捕捉，pointerup/cancel/lostcapture 解除；冷卻環＋秒數／就緒文字、可用時 8ms 震動、按住縮至 94%。使用既有毛氈圖示及半透明米色／青綠縫線底座，沒有新插畫。
- 方向／全螢幕：coarse pointer 或 maxTouchPoints 啟用觸控模式；直式對戰顯示四語旋轉提示，完全停止模擬，橫向自動續戰。桌面視窗變窄不受影響。Play／Start／Continue／Restart 的使用者手勢要求 fullscreen（navigationUI hide，WebKit 備援）再嘗試 landscape lock；拒絕／缺少 API 靜默回退，iOS Safari 通常不支援 HTML 元素全螢幕。觸控工具列有 ≥48px 全螢幕切換，離開對戰解除方向鎖並退出全螢幕。
- 無障礙：全部可鍵盤操作；畫面按鈕也是 `<button>`，Enter／Space 可觸發；鍵位在說明對話框列出。

## 5. 畫面與版面（HUD 不可遮角色）
- 結構：`HUD 區`（頂列＋兩個玩家牌）／`橫幅區`（倒數、FIGHT、KO、回合提示，保留固定高度，**不蓋舞台**）／`舞台 canvas`（只畫世界：背景、平台、角色、投射物、特效、傷害百分比小跳字、畫外箭頭）／`控制區`（觸控按鈕）。除 canvas 內的世界物件外，**任何 DOM 元件不得與舞台矩形相交**（`test:hud` 以 7 種視窗逐一量測）。
- 鏡頭：跟隨兩位角色的 AABB，保留邊距，可視寬度在 900–1600 u 之間，隨舞台長寬比調整；舞台縮放後角色高度 ≥ 舞台高度的 14%（在 360×640 也成立）；角色離開畫面時在舞台邊緣畫小箭頭＋距離。
- 觸控橫式：頂部同列放雙方玩家牌、計時與 5 顆工具鈕（說明／音效／語言／全螢幕／暫停，≥48px）；中央上方 64px 橫幅，中央下方舞台，左右專用欄為 140px 搖桿與 164px 動作鈕區。HUD 字 ≥18px，舞台在 844×390 高 250px、667×375 高 235px、568×320 高 180px（皆 ≥45% 螢幕高）；攝影機及模擬不變，控制不疊舞台。四邊各自使用 safe-area inset，對戰防止 overscroll，控制 touch-action:none。直式對戰只顯示旋轉提示；選單、選角、結算與可捲動對話框支援兩種方向。桌面：置中、最大寬 1400，保留鍵盤提示與直式響應，不顯示搖桿／觸控鈕。
- HUD：玩家牌（頭像＝角色 idle 圖縮圖、名稱、綻線 % ≥ 20px、鈕扣 ×3 ≥ 28px）、計時、暫停／說明／音效／語言（≥ 48px）。字 ≥ 18px，關鍵數字 ≥ 20px，4 語不溢出。
- 開始頁：`logo_base.png`（限高）、標題文字（真文字，與 logo 不重疊）、Play、語言／音效；背後是 AI 對 AI 的實際對戰（無音效，Play 後才有 BGM）。`test:title` 7 視窗。
- 補丁盃進度頁、選角頁（4 角色卡，鎖定者顯示 icon_lock＋解鎖條件文字）、結算（勝/敗、統計：擊飛次數、最高綻線、時間）。
- 首次 30 秒教學（橫幅區內、非阻擋、可略過、「?」重開、自動前進）：①搖桿移動 ②跳躍鈕 ③出拳 ④法術與搖桿瞄準 ⑤縫線鉤（拉人／回場提示）；觸控與桌面各用對應四語文字，說明對話框同時列出鍵盤和觸控方法。

## 6. 動畫（單張姿勢＋程式動畫，沒有骨架）
- 每個角色 8 張（`<id>_idle1/idle2/run/jump/punch/cast/hurt/tumble`，同畫布、腳底置中）：站立每 0.5 秒換 idle1/idle2；移動用 run（左右翻轉）；空中 jump；出拳 punch（0.2 秒）；法術 cast（0.3 秒）；受擊 hurt；強擊飛 tumble 並依速度旋轉。
- 布偶晃動：角色身體依水平加速度傾斜（彈簧，過衝後回正）、落地擠壓／起跳拉伸、受擊時彈跳抖動；全部在 canvas 以 transform 完成，`prefers-reduced-motion` 時關閉晃動與鏡頭震動。
- 特效：`fx_hit` 命中星、投射物 `fx_fire/ice/wind/rock`（旋轉／縮放脈動）、`fx_spool`（上下浮動）、`fx_shield` 包住角色、`fx_scissors` 落下、縫線鉤用繪製的粉紅線段（canvas 畫線＋線軸）。
- 不得用程式重畫美術，只能用素材。

## 7. 素材（`assets/MANIFEST.md`；原始回圖在 `assets/raw/`，處理腳本 `/workspace/gamegen-games/_tools/run_prep8.py`，僅去背／裁切／對齊）
- 畫風：圖鑑 #197「平面毛氈布貼遊戲」（分類：紙、布與裝飾）；主題「縫線布偶法師的擂台對決」由 Grok Bot 依玩法決定（Jambo 授權用團隊技能製作）。
- 角色 `ember|frost|gale|rune` × 8 姿勢；`fx_*`（fire, ice, wind, rock, hit, spool, scissors, shield）；`icon_*`（punch, spell, hook, jump, life, pause, sound, mute, language, help, trophy, lock）；`logo_base.png`（徽章，不含字）；`plat_{meadow,lantern,ice}_{main,small}.png`；`bg_{meadow,lantern,ice}.webp`；`public/poster.png`（9:16 原生圖）。
- 音效（`public/common/audio/`，`AUDIO_NOTES.md`）：bgm_base、sfx_click/hover/punch/hit/cast_fire/cast_ice/cast_wind/cast_rock/jump/hook/spool/ko/snip/shield/count/go/win/lose。

## 8. 存檔與平衡
- localStorage v1：語言、音效、教學已看、浮動數字、解鎖角色、補丁盃進度（目前場次、玩家角色、最高完成）、統計、**進行中對戰完整快照**（模擬狀態＋RNG 狀態＋場次資訊，約 1 秒節流與 pagehide/visibilitychange 時存；壞資料安全重置；對戰結束清除）。載入時若有存檔，主選單出現「繼續對戰」。
- 預設語言跟隨瀏覽器（zh-TW/HK/MO/Hant→zh-tw、zh-CN/SG/Hans/zh→zh-cn、ja→ja、其他 en），已選過者優先。
- `npm run test:sim`：AI 對 AI 循環賽（4 角色 × 3 場地 × 每組 ≥ 16 場，等級 4）— 目標：每個角色整體勝率 38–62%；平均對戰時長 40–110 秒；超時（120 秒）比例 < 15%；以「新手玩家機器人」（反應 0.5 秒、不使用鉤）對 L1…L6：勝率單調下降，L1 ≥ 65%、L6 ≤ 35%。最終常數與實測結果寫回本節。

### Final implementation and measured balance (2026-10-30)

All balance values live in `src/game/config.ts`. The simulation uses injected seeds, fixed 1/60-second steps and its own 32-bit LCG; it never reads the DOM, wall time or `Math.random`. Browser frame time only determines how many fixed steps to run. AI decisions and RNG state are part of the versioned snapshot.

| Common tuning | Final value |
|---|---|
| Gravity / terminal fall / horizontal acceleration | 2400 / 1500 / 3400 u/s² (terminal: u/s) |
| Ground friction / air friction | 2400 / 300 u/s²; ice ground ×0.4 except Frost |
| Hitbox / rendered frame height / feet anchor | 56×104 / 142 u / bottom centre, 8 source pixels above bottom |
| Initial spawn / respawn | x 650 and 950, feet y 500; respawn y 300 after 1.5s, then 2s invulnerability |
| Lives / clock / countdown | 3 buttons / 120s / 3s |
| Punch | 6 damage; 0.35s cooldown; 106u reach; knockback base 290 + Fray×7.4 |
| Hook | 420u range, ±30° cone; 4 damage; 2.5s cooldown; miss 1s |
| Burn / chill | 2s at +2 Fray/s; 1.5s at 60% speed, Rune immune |
| Hitstun | min(0.6, 0.15 + knockback / 6000) seconds |
| Spool / shield | every 12–18s, expires after 10s; shield 6s, one blocked hit, all cooldowns refreshed |
| Scissors | every 6–9s, 1s warning, 120u width, 10 damage; knockback 850 + Fray×6 upward |
| Ice unravelling | starts at 60s, each edge 30u/s, minimum platform width 300u |
| Surface inset, main / small (image-width fraction) | meadow .042 / .070; lantern .044 / .055; ice .047 / .065 |

| Character | Speed / jump / weight | Spell cooldown / projectile speed | Damage | Knockback base + Fray scale |
|---|---|---|---|---|
| Ember | 360 / 960 / 1.0 | 1.2s / 720 | 9 + burn | 330 + Fray×7.8 |
| Frost | 380 / 980 / 0.9 | 1.0s / 900 | 6 + chill | 300 + Fray×7.8 |
| Gale | 400 / 920 / 0.8 | 1.4s / 520 | 3 | 420 + Fray×9.4, flatter launch |
| Rune | 320 / 900 / 1.25 | 1.8s / 670 | 12 | 440 + Fray×9; rock gravity 1400, ground wave 550u/s for .4s |

Knockback divides by weight; Rune's weight of 1.25 provides the designed 20% reduction. Gale's held-jump falling gravity is ×0.3. Fire and ice cancel; Rune rocks become a travelling ground shockwave. Rendering uses only final art, with spring lean, landing squash, jump stretch and reduced-motion suppression. Reduced motion fixes camera width at 1200u to avoid zooming, while retaining framing by panning and off-screen arrows with numerical distances. Snow uses small supplied ice textures.

AI L1→L6 reaction times: .55/.44/.34/.25/.18/.12s; accuracy .24/.38/.52/.66/.83/.96; rescue .30/.43/.56/.70/.83/.95; aggression .08/.35/.54/.72/.86/.98. The novice bot has .5s reactions, .64 accuracy, .75 aerial-jump rescue, .65 aggression and **never uses Hook**. Tuning reduced beginner attack frequency and calibrated novice jump recovery; the novice bot remains identical against every level. No character-, seed-, or score-specific handicaps are used by the balance suite.

`npm run test:sim` runs every unordered character pair on all three stages, 16 games per pairing/stage with alternating seats: **288 full production matches**, L4, 144 appearances per character. Seeds: `1000 + a*400 + b*80 + stageIndex*20 + n`. Novice tests: 96 matches per level, cycling characters, opponents and stages, seeds 7000–7095. All use three lives and the ordinary 120s timer, without browser debug modes.

| Character | Wins / appearances | Win rate | Target |
|---|---|---|---|
| Ember | 80 / 144 | 55.56% | 38–62% PASS |
| Frost | 71 / 144 | 49.31% | 38–62% PASS |
| Gale | 55 / 144 | 38.19% | 38–62% PASS |
| Rune | 82 / 144 | 56.94% | 38–62% PASS |

Mean match duration **46.18s** (target 40–110s); timeout rate **0.00%** (target <15%).

| Opponent | Novice wins / matches | Novice win rate |
|---|---|---|
| L1 | 81 / 96 | 84.38% |
| L2 | 52 / 96 | 54.17% |
| L3 | 16 / 96 | 16.67% |
| L4 | 1 / 96 | 1.04% |
| L5 | 0 / 96 | 0.00% |
| L6 | 0 / 96 | 0.00% |

All six balance assertions pass: four-character range, duration, timeout rate, non-increasing novice wins, L1 novice ≥65%, L6 novice ≤35%. These are deterministic bot measurements; human difficulty and game feel remain to be playtested.

Browser QA flags are isolated and documented in README. They accelerate ordinary simulation and can handicap the opponent for result/unlock coverage; they never write or clear real progression or match saves. These handicaps are **not** used in `test:sim`.

One Play gesture opens the main menu and starts music; there is no separate Enter gate. The title exhibition starts simulating immediately and has no combat SFX (before Play, WebAudio remains suspended). All ordinary HUD controls, coach and banners occupy layout cells outside the canvas. Modal dialogs hide the canvas, make the game surface inert, and trap/restore focus; visible dialog controls therefore never intersect a world canvas. Snapshots save once per simulated second and on page hide, and preserve the RNG and AI decisions.


### Touch revision QA evidence

Production simulation, camera and balance constants are unchanged. The deterministic suite remains 25/25 logic checks and six balance targets across 288 round-robin plus 576 novice matches. Four dictionaries now contain 108 matching non-empty keys. The dedicated touch controls browser section verifies geometry, minimum sizes, stage/fighter scale, pointer capture, simultaneous multi-touch, cooldown text/rings, portrait pause and automatic resume, fullscreen requests/denials/WebKit fallback, localisation, axe accessibility, and desktop behavior. Final build and pack PASS. Browser **191/191** (including **61 dedicated touch checks**); title/loading **84/84** across seven viewports and four languages. Axe: **20/20 audits, zero violations**, covering touch portrait menus, landscape play/pause/help/result, desktop surfaces and the rotate overlay. Console errors/warnings/failed requests: zero in the normal desktop and touch runs. ZIP: **90 entries**, index.html and poster.png at root; all **5 independent archive checks** pass (both root files, no dist wrapper, no sourcemaps, CRC integrity).

Final logs: `/workspace/gamegen-games/_reports/stitch-arena_touch_{build,i18n,logic,sim,headless,title,pack}.log`; summary: `stitch-arena_touch_validation.json`. All five required screenshots were generated and visually inspected: `stitch-arena_touch_844x390.png`, `stitch-arena_touch_667x375.png`, `stitch-arena_touch_932x430.png`, `stitch-arena_rotate_overlay.png`, `stitch-arena_touch_coach.png`. A separate 568×320 Japanese capture exposed and verified the fix for wrapped HUD labels. Touch tests include a fine-pointer touch laptop, three simultaneous fingers, pointer cancellation, full state equality while paused by rotation, and live translated HUD/control labels at 844×390, 667×375 and 568×320. Physical-device feel and human audio listening remain untested. No git add/commit or deployment was performed.


### Catalog navigation revision (2026-10-30)

The title screen, main home menu and pause dialog now contain a native, localised `<a href="../">` labelled Back to catalog / 返回目錄 / 返回目录 / カタログに戻る. It uses the existing secondary-button style, 48px minimum height, hover/click audio, and a contrasting 3px keyboard focus ring. The title layout reserves a separate row for it; neither the HUD nor play area changes. Modal focus trapping includes anchors and still restores the pause trigger.

Click/Enter first invokes orientation unlock and fullscreen exit with the existing guarded helper, synchronously flushes current progression and any unfinished production match through `saveNow` (bypassing the periodic snapshot throttle), then suspends audio through the same method used by visibility handling. Native navigation is allowed. Title/home departures retain existing saved matches; finished matches and isolated debug sessions never write match snapshots.

Validation: build and pack PASS; **109 keys × four languages**; **25/25 logic tests**; **6/6 balance targets across 864 matches**; **311/311 browser assertions** (120 catalog checks plus the original 191), including **24 axe audits with zero violations**; **84/84 title/loading assertions** across all seven viewports and four languages, with pairwise title/link overlap checks. The shared axe path specified in the task is absent in this environment, so the browser utility falls back to the game's installed axe-core. ZIP: **90 entries, 5/5 independent archive checks**. Screenshots `back_stitch-arena_title.png` and `back_stitch-arena_pause.png` in `_reports/` were visually inspected; no clipping or overlap found. Local logs and the summary are under ignored `qa/back-catalog/`. No git add/commit or deployment performed.
