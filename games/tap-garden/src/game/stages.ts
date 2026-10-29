// Stage progression, kept pure (no GameState dependency). The garden advances a
// stage once it has *earned* this stage's dew goal; boss stages (every 5th) also
// require a plant of a minimum level. Clearing a stage pays a chest worth
// CHEST_SECONDS of passive income at the new stage's rate.

import { stageGoal, isBossStage, bossRequiredLevel, CHEST_SECONDS } from './config';

export { stageGoal, isBossStage, bossRequiredLevel };

/** Highest plant level currently on the board (0 = empty garden). */
export function topPlantLevel(plots: number[]): number {
  let top = 0;
  for (const v of plots) if (v > top) top = v;
  return top;
}

/** Can the garden leave `stage` right now (ignoring the dew goal)? */
export function bossSatisfied(stage: number, plots: number[]): boolean {
  if (!isBossStage(stage)) return true;
  return topPlantLevel(plots) >= bossRequiredLevel(stage);
}

export interface StageSettle {
  stage: number;
  earned: number;
  maxStage: number;
  chestDew: number; // total chest dew awarded across the advances
  advanced: number; // how many stages were cleared
}

/**
 * Advance as many stages as the earned dew (and boss requirements) allow.
 * `passiveAtStage(stage)` returns the passive dew/sec *as if* at that stage, so
 * the chest reward scales with the stage just entered.
 */
export function settleStages(
  stage: number,
  earned: number,
  maxStage: number,
  plots: number[],
  passiveAtStage: (stage: number) => number,
): StageSettle {
  let chestDew = 0;
  let advanced = 0;
  // Guard against pathological loops; real games clear a handful at most.
  for (let guard = 0; guard < 1000; guard++) {
    const goal = stageGoal(stage);
    if (earned < goal || !bossSatisfied(stage, plots)) break;
    earned -= goal;
    stage += 1;
    if (stage > maxStage) maxStage = stage;
    chestDew += CHEST_SECONDS * passiveAtStage(stage);
    advanced += 1;
  }
  return { stage, earned, maxStage, chestDew, advanced };
}
