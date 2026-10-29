# Audio notes — Shelf Sort

All audio in `public/common/audio/` is **original procedural synthesis** generated
by `/workspace/gamegen-games/_tools/audio_gen.py`. There are no third-party
samples and no licence obligations. The clips are placeholders awaiting a human
ear pass (levels, EQ, final selection).

| file | where it is used |
|---|---|
| `bgm_base.mp3` | Looping background music. Starts after the "Enter game" gesture; pauses when the tab is hidden; muted by the sound toggle. |
| `sfx_hover.mp3` | Pointer-enter on every button. |
| `sfx_click.mp3` | Press on every button; also on Restart. |
| `sfx_pick.mp3` | Lifting a goods item (select), putting a lifted item back down, and Undo. |
| `sfx_place.mp3` | Placing a lifted item into an empty slot (when it does not complete a shelf). |
| `sfx_clear.mp3` | A shelf fills with three matching goods and clears. |
| `sfx_win.mp3` | The level is fully sorted (win overlay). |
| `sfx_nope.mp3` | Invalid-slot feedback at 35% gain: tapping an empty slot with nothing lifted, or an occupied destination while holding an item. No move or selection change. |

No sound effects play during the title demo — only the BGM, and only after the
enter gesture.
