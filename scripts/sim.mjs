// Headless difficulty sim. Runs the real game logic with two bots:
//   - a corridor-follower with 150 ms reaction delay  (target avg ~40-90 s)
//   - a perfect-play corridor-follower                (should survive 3+ min,
//     including at the difficulty cap)
//
// Usage: node scripts/sim.mjs [games]
import { GameSim, CorridorBot, FIXED_DT, CONFIG } from '../src/game/logic.ts';

function runGame(seed, delay, viewW, lanternXFrac, maxTime, forceCap = false) {
  const sim = new GameSim(seed);
  sim.setView(viewW, lanternXFrac);
  sim.reset(seed);
  if (forceCap) {
    // Pretend the whole difficulty ramp has already elapsed.
    sim.time = Math.max(
      CONFIG.speedRampTime,
      CONFIG.corridorRampTime,
      CONFIG.hazardDensityRampTime,
    );
  }
  const bot = new CorridorBot(delay);
  const maxSteps = Math.ceil(maxTime / FIXED_DT);
  for (let i = 0; i < maxSteps; i++) {
    const hold = bot.decide(sim, FIXED_DT);
    sim.step(FIXED_DT, hold);
    if (sim.over) break;
  }
  return {
    time: sim.time,
    dist: sim.distanceMeters(),
    sparks: sim.sparksCollected,
    hits: sim.hits,
    cause: sim.deathCause,
  };
}

function stats(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const sum = s.reduce((a, b) => a + b, 0);
  const avg = sum / s.length;
  const med = s[Math.floor(s.length / 2)];
  return { avg, med, min: s[0], max: s[s.length - 1] };
}

const games = Number(process.argv[2] || 60);

const views = [
  { name: 'portrait 390x844', viewW: (640 * 390) / 844, xf: 0.28 },
  { name: 'wide 1280x720', viewW: (640 * 1280) / 720, xf: 0.3 },
  { name: 'square 626x890', viewW: (640 * 626) / 890, xf: 0.3 },
];

for (const v of views) {
  const slow = [];
  const slowHits = [];
  const perfect = [];
  const causes = {};
  for (let i = 0; i < games; i++) {
    const r = runGame(1000 + i, 0.15, v.viewW, v.xf, 240);
    slow.push(r.time);
    slowHits.push(r.hits);
    causes[r.cause] = (causes[r.cause] || 0) + 1;
    perfect.push(runGame(1000 + i, 0, v.viewW, v.xf, 240).time);
  }
  const ss = stats(slow);
  const ps = stats(perfect);
  console.log(`\n== ${v.name} (viewW=${v.viewW.toFixed(0)}) ==`);
  console.log(
    `  150ms bot: avg ${ss.avg.toFixed(1)}s  med ${ss.med.toFixed(1)}s  min ${ss.min.toFixed(1)}  max ${ss.max.toFixed(1)}  avgHits ${(slowHits.reduce((a, b) => a + b, 0) / games).toFixed(1)}  causes ${JSON.stringify(causes)}`,
  );
  console.log(
    `  perfect  : avg ${ps.avg.toFixed(1)}s  med ${ps.med.toFixed(1)}s  min ${ps.min.toFixed(1)}  max ${ps.max.toFixed(1)}`,
  );
  const perfSurvive = perfect.filter((t) => t >= 180).length;
  console.log(`  perfect survived 180s: ${perfSurvive}/${games}`);
}

// Perfect play at the difficulty cap from the start.
let capSurvive = 0;
const capGames = Math.min(games, 30);
for (let i = 0; i < capGames; i++) {
  const r = runGame(5000 + i, 0, (640 * 390) / 844, 0.28, 200, true);
  if (r.time >= 180) capSurvive++;
}
console.log(`\n== perfect @ cap (portrait) survived 180s: ${capSurvive}/${capGames} ==`);
