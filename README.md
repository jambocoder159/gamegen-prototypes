# GameGen Prototypes｜小遊戲試玩目錄

七款可直接在手機瀏覽器試玩的 HTML5 小遊戲原型（React 19 + TypeScript + Vite，符合 GameGen 平台規範）。

**目錄首頁：<https://jambocoder159.github.io/gamegen-prototypes/>**

| # | 遊戲 | 玩法 | 試玩 | 原始碼 |
|---|---|---|---|---|
| 1 | **麻糬合成** Mochi Merge | 滑動整個 4×4 盤面，同階麻糬撞在一起合成下一階，一路合到金龍麻糬。 | [開始玩](https://jambocoder159.github.io/gamegen-prototypes/mochi-merge/) | [`games/mochi-merge`](games/mochi-merge) |
| 2 | **孔明燈升空** Lantern Rise | 按住上升、放開下沉，避開烏鴉與雷雨雲，吃星火補燈油，飛得越遠越高分。 | [開始玩](https://jambocoder159.github.io/gamegen-prototypes/lantern-rise/) | [`games/lantern-rise`](games/lantern-rise) |
| 3 | **夜市麵攤** Noodle Night | 依訂單泡泡點配料做麵、按鈴上餐，連續上對有連擊加成，上錯三次打烊。 | [開始玩](https://jambocoder159.github.io/gamegen-prototypes/noodle-night/) | [`games/noodle-night`](games/noodle-night) |
| 4 | **貨架理貨** Shelf Sort | 把亂擺的商品搬到空位，每層擺滿 3 件相同商品，12 關、無限復原。 | [開始玩](https://jambocoder159.github.io/gamegen-prototypes/shelf-sort/) | [`games/shelf-sort`](games/shelf-sort) |
| 5 | **芽芽花園** Tap Garden | 點花盆賺露珠，升級花盆、買種子合成、闖關打王；轉生換太陽幣，用 12 件寶物讓下一輪更快。 | [開始玩](https://jambocoder159.github.io/gamegen-prototypes/tap-garden/) | [`games/tap-garden`](games/tap-garden) |
| 6 | **麻將牌組** Mahjong Deck | 麻將接龍配對消除＋每關三選一能力卡，撐過五個牌堆。 | [開始玩](https://jambocoder159.github.io/gamegen-prototypes/mahjong-deck/) | [`games/mahjong-deck`](games/mahjong-deck) |

> 這些是原型試玩版：音效為程式合成的佔位版、數值與難度仍在調整，尚未在實機（手機／摺疊機）逐一驗證。

## Repo 結構

```
index.html, catalog/        目錄首頁（靜態 HTML/CSS）與封面圖
<game-id>/                  已建置（vite build）的遊戲，GitHub Pages 直接提供；網址即 /<game-id>/
games/<game-id>/            各遊戲完整原始碼（以 git subtree 匯入，保留各自 commit 歷史）
scripts/test-catalog.mjs    目錄頁測試（axe WCAG 2.2 AA、連結、版面、截圖）
```

每款遊戲的設計文件在 `games/<game-id>/PLAN.md`，素材清單在 `games/<game-id>/assets/MANIFEST.md`，音效說明在 `AUDIO_NOTES.md`。

## 開發

```bash
cd games/<game-id>
npm install
npm run dev            # 本機開發
npm run build          # tsc + vite build
npm run check:i18n     # 四語系 key 檢查
npm run test:headless  # 無頭瀏覽器整合測試（需要 /usr/bin/google-chrome）
npm run pack           # 輸出 <game-id>.zip（GameGen 上傳格式）
```

## 更新線上版本

線上版是各遊戲 `dist/` 的內容複製到根目錄 `<game-id>/`，並把 `config/generalConfiguration.json` 的 `commonPath` 設為 `./common/`（子路徑部署用，避免對 `/common/` 的 404 探測）：

```bash
cd games/<game-id> && npm run build
rm -rf ../../<game-id> && cp -r dist ../../<game-id>
printf '{ "isLocal": true, "commonPath": "./common/" }\n' > ../../<game-id>/config/generalConfiguration.json
```

## 目錄頁測試

```bash
npm install
npm run test:catalog   # 需要 /usr/bin/google-chrome；截圖輸出到 $CATALOG_SHOTS（預設 /workspace/gamegen-games/_reports）
```

## 授權與素材說明

- 圖片由 AI 生圖產生並經程式切圖／去背，音效為程式合成（見各遊戲 `AUDIO_NOTES.md`），沒有第三方素材。
- 無追蹤、無外部腳本、無內購、無真錢元素。
