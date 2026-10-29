// Entry bundled by esbuild so Node (sim + tests) runs the exact same TS logic the
// game ships. Namespaced exports avoid re-export name collisions.
import * as Config from '../src/game/config';
import * as Logic from '../src/game/logic';
import * as Relics from '../src/game/relics';
import * as Upgrades from '../src/game/upgrades';
import * as Rebirth from '../src/game/rebirth';
import * as Stages from '../src/game/stages';
import * as Format from '../src/game/format';
import * as Save from '../src/game/save';

import * as Rng from '../src/game/rng';

export { Rng, Config, Logic, Relics, Upgrades, Rebirth, Stages, Format, Save };
