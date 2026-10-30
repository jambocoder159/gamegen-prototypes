# Stitch Arena asset manifest

All final generated felt-appliqué art is used as supplied. Raw JPEG sheets are in `assets/raw/`; processing by `/workspace/gamegen-games/_tools/run_prep8.py` only removes backgrounds, crops, and aligns frames. No repainting. Characters face right and share a canvas within each character; feet are eight pixels above the bottom.

| Texture | Pixels | Purpose |
|---|---|---|
| `bg_ice.webp` | 1280×720 | Ice world background, cover-scaled |
| `bg_lantern.webp` | 1280×720 | Lantern world background, cover-scaled |
| `bg_meadow.webp` | 1280×720 | Meadow world background, cover-scaled |
| `ember_cast.png` | 322×305 | Ember: Spell / hook pose |
| `ember_hurt.png` | 322×305 | Ember: Hit reaction |
| `ember_idle1.png` | 322×305 | Ember: First idle frame and portrait thumbnail |
| `ember_idle2.png` | 322×305 | Ember: Second idle frame |
| `ember_jump.png` | 322×305 | Ember: Jump / aerial pose |
| `ember_punch.png` | 322×305 | Ember: Punch animation |
| `ember_run.png` | 322×305 | Ember: Movement pose |
| `ember_tumble.png` | 322×305 | Ember: Strong knockback tumble |
| `frost_cast.png` | 264×284 | Frost: Spell / hook pose |
| `frost_hurt.png` | 264×284 | Frost: Hit reaction |
| `frost_idle1.png` | 264×284 | Frost: First idle frame and portrait thumbnail |
| `frost_idle2.png` | 264×284 | Frost: Second idle frame |
| `frost_jump.png` | 264×284 | Frost: Jump / aerial pose |
| `frost_punch.png` | 264×284 | Frost: Punch animation |
| `frost_run.png` | 264×284 | Frost: Movement pose |
| `frost_tumble.png` | 264×284 | Frost: Strong knockback tumble |
| `fx_fire.png` | 264×224 | Fireball projectile |
| `fx_hit.png` | 280×257 | Impact appliqué |
| `fx_ice.png` | 288×163 | Ice arrow projectile |
| `fx_rock.png` | 222×226 | Rune rock and shockwave |
| `fx_scissors.png` | 235×279 | Warning and falling stage hazard |
| `fx_shield.png` | 214×218 | One-hit shield ring |
| `fx_spool.png` | 233×233 | Shield pickup and hook endpoint |
| `fx_wind.png` | 271×232 | Wind spiral projectile |
| `gale_cast.png` | 334×262 | Gale: Spell / hook pose |
| `gale_hurt.png` | 334×262 | Gale: Hit reaction |
| `gale_idle1.png` | 334×262 | Gale: First idle frame and portrait thumbnail |
| `gale_idle2.png` | 334×262 | Gale: Second idle frame |
| `gale_jump.png` | 334×262 | Gale: Jump / aerial pose |
| `gale_punch.png` | 334×262 | Gale: Punch animation |
| `gale_run.png` | 334×262 | Gale: Movement pose |
| `gale_tumble.png` | 334×262 | Gale: Strong knockback tumble |
| `icon_help.png` | 236×232 | Help control/status icon |
| `icon_hook.png` | 237×240 | Hook control/status icon |
| `icon_jump.png` | 236×240 | Jump control/status icon |
| `icon_language.png` | 237×232 | Language control/status icon |
| `icon_life.png` | 236×239 | Life control/status icon |
| `icon_lock.png` | 236×232 | Lock control/status icon |
| `icon_mute.png` | 236×239 | Mute control/status icon |
| `icon_pause.png` | 236×239 | Pause control/status icon |
| `icon_punch.png` | 237×240 | Punch control/status icon |
| `icon_sound.png` | 237×239 | Sound control/status icon |
| `icon_spell.png` | 236×240 | Spell control/status icon |
| `icon_trophy.png` | 237×232 | Trophy control/status icon |
| `logo_base.png` | 605×569 | Title/menu emblem, separate from real title text |
| `plat_ice_main.png` | 451×219 | Ice main platform; scaled to collision width |
| `plat_ice_small.png` | 289×185 | Ice small platform; scaled to collision width |
| `plat_lantern_main.png` | 451×206 | Lantern main platform; scaled to collision width |
| `plat_lantern_small.png` | 289×197 | Lantern small platform; scaled to collision width |
| `plat_meadow_main.png` | 454×178 | Meadow main platform; scaled to collision width |
| `plat_meadow_small.png` | 301×157 | Meadow small platform; scaled to collision width |
| `rune_cast.png` | 287×283 | Rune: Spell / hook pose |
| `rune_hurt.png` | 287×283 | Rune: Hit reaction |
| `rune_idle1.png` | 287×283 | Rune: First idle frame and portrait thumbnail |
| `rune_idle2.png` | 287×283 | Rune: Second idle frame |
| `rune_jump.png` | 287×283 | Rune: Jump / aerial pose |
| `rune_punch.png` | 287×283 | Rune: Punch animation |
| `rune_run.png` | 287×283 | Rune: Movement pose |
| `rune_tumble.png` | 287×283 | Rune: Strong knockback tumble |

Platform top insets are measured at the middle of the felt top: main/small, as a fraction of width: meadow .042/.070; lantern .044/.055; ice .047/.065. Renderer places the image at collision y minus scaled inset.

`public/poster.png` is the supplied native 9:16 poster, excluded from preloading and copied to the ZIP root.

| Audio | Purpose |
|---|---|
| `bgm_base.mp3` | Music loop; see AUDIO_NOTES.md |
| `sfx_cast_fire.mp3` | cast fire event; see AUDIO_NOTES.md |
| `sfx_cast_ice.mp3` | cast ice event; see AUDIO_NOTES.md |
| `sfx_cast_rock.mp3` | cast rock event; see AUDIO_NOTES.md |
| `sfx_cast_wind.mp3` | cast wind event; see AUDIO_NOTES.md |
| `sfx_click.mp3` | click event; see AUDIO_NOTES.md |
| `sfx_count.mp3` | count event; see AUDIO_NOTES.md |
| `sfx_go.mp3` | go event; see AUDIO_NOTES.md |
| `sfx_hit.mp3` | hit event; see AUDIO_NOTES.md |
| `sfx_hook.mp3` | hook event; see AUDIO_NOTES.md |
| `sfx_hover.mp3` | hover event; see AUDIO_NOTES.md |
| `sfx_jump.mp3` | jump event; see AUDIO_NOTES.md |
| `sfx_ko.mp3` | ko event; see AUDIO_NOTES.md |
| `sfx_lose.mp3` | lose event; see AUDIO_NOTES.md |
| `sfx_punch.mp3` | punch event; see AUDIO_NOTES.md |
| `sfx_shield.mp3` | shield event; see AUDIO_NOTES.md |
| `sfx_snip.mp3` | snip event; see AUDIO_NOTES.md |
| `sfx_spool.mp3` | spool event; see AUDIO_NOTES.md |
| `sfx_win.mp3` | win event; see AUDIO_NOTES.md |

All 19 audio files are procedural synthesis from `/workspace/gamegen-games/_tools/audio_gen.py game8`. See AUDIO_NOTES.md for the complete event mapping.
