# Stitch Arena audio

All 19 MP3s are original procedural synthesis from `/workspace/gamegen-games/_tools/audio_gen.py game8`, using felt, wooden-percussion and kalimba-like timbres. No third-party samples or licence obligations. Human listening review of mix, loudness and musical selection remains outstanding.

| File | Use |
|---|---|
| bgm_base.mp3 | Loop after the single Play gesture resumes WebAudio. |
| sfx_click.mp3 | Every button press, including held touch controls. |
| sfx_hover.mp3 | Pointer entry on buttons. |
| sfx_punch.mp3 | Punch begins. |
| sfx_hit.mp3 | Unshielded attack lands. |
| sfx_cast_fire.mp3 | Ember fireball. |
| sfx_cast_ice.mp3 | Frost ice arrow. |
| sfx_cast_wind.mp3 | Gale wind spiral. |
| sfx_cast_rock.mp3 | Rune rock. |
| sfx_jump.mp3 | Ground or aerial jump. |
| sfx_hook.mp3 | Thread Hook attempt, including misses and rescue. |
| sfx_spool.mp3 | Spool pickup and cooldown refresh. |
| sfx_shield.mp3 | Shield absorbs a hit. |
| sfx_ko.mp3 | Either fighter loses a button. |
| sfx_snip.mp3 | Scissors strike after warning. |
| sfx_count.mp3 | Countdown advances. |
| sfx_go.mp3 | Fight begins or sudden death begins. |
| sfx_win.mp3 | Player victory. |
| sfx_lose.mp3 | Player defeat. |

The preload gate fetches and decodes each buffer before reporting that asset complete. All playback reuses those buffers. The title demo emits no combat audio. Mute persists; the audio context suspends when the tab is hidden. Missing or undecodable audio is silent.
