# Match Hero Tower v2 asset manifest

企劃提供的原始美術保留在 `assets/raw/*.jpg`。由 `_tools/prep_mh2.py` 去背、裁切、對齊及輸出；只有技術處理，未重新繪製。程式工作不修改 `public/common/textures/*`。

| 組別 | 使用檔案 | 顯示規則 |
|---|---|---|
| 勇者 | hero_idle1, hero_idle2, hero_windup, hero_slash | 同畫布、左下對齊，同持劍手，絕不翻轉 |
| 普通敵人 | enemy_slime, bat, skeleton, goblin, ghost, golem | 全部原生向左，按唯一enemyId渲染 |
| BOSS | boss_dragon, boss_demon | 原生向左，較大但依比例contain |
| 寶石 | gem_sword, fire, heart, coin, mana, star | 盤面與fixed飛行複製品 |
| UI | icon_coin, sp, heart, sword, fire, heal, haste, lock, shield, sound, language, upgrade, rebirth, relic_feather, relic_ring, danger | 個別PNG，無atlas或裁切座標 |
| 特效 | fx_slash, slash_crit, spark, burst, heal, fireball, orb, claw | 全部預載；自動攻擊、消除、技能與敵方攻擊使用相應原圖，orb在水晶抵達SP條時閃現 |
| Logo | logo_base.png | 開始頁受高度限制 |
| 背景 | bg_a, bg_b, bg_c.webp | 每五層循環，腳底在舞台84% |
| 海報 | public/poster.png | 432×768、9:16、實際打鬥擷取；scripts/capture-v2.mjs |

所有PNG使用 `image-rendering:pixelated`。UI舊atlas已由企劃刪除，程式不再引用。

`scripts/check-sprites.mjs` 以zlib解PNG，檢查alpha、外框、粉紅比例、二值alpha與3px dilation後的8鄰域元件。提供素材目前27/43通過、16檔失敗；完整逐檔報告在 `_reports/sprite_check_match-hero.txt`。此工作保留原圖，不將檢查失敗隱藏或冒稱修圖完成。

音效沿用 `public/common/audio` 的既有程式合成chiptune。BOSS重擊使用sfx_boss，普通揮砍／暴擊／擊殺／消除／技能／治癒／受擊各使用既有對應音效。
