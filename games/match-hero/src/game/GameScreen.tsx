import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { useAudio } from "../platform/AudioContext";
import { useViewport } from "../platform/layout";
import { useReducedMotion } from "../platform/reducedMotion";
import {
  CONFIG,
  RELICS,
  REBIRTH_MIN_FLOOR,
  type Relic,
  type Skill,
  type Upgrade,
} from "./config";
import * as L from "./logic";
import { Art, Icon } from "./Art";
import { Modal } from "./Modal";
import { CatalogLink } from "./CatalogLink";
import { persistRun } from "./persistence";
import type { ImageKey } from "../config/assets";
import { useImages } from "../platform/ImagesContext";
import { CombatEffects } from "./effects";
const SKILLS: Skill[] = ["fireball", "heal", "haste"];
const UPGRADES = Object.keys(CONFIG.upgrades) as Upgrade[];
const UKEY: Record<Upgrade, string> = {
  atk: "atk",
  speed: "speed",
  crit: "crit",
  hp: "hp",
  power: "power",
  gold: "goldFind",
  focus: "focus",
};
function enemyArt(floor: number, wave: number): ImageKey {
  const stage = Math.floor((floor - 1) / 5) % 3;
  const foes =
    stage === 0
      ? ["enemy_slime", "enemy_bat", "enemy_skeleton"]
      : stage === 1
        ? ["enemy_goblin", "enemy_ghost", "enemy_skeleton"]
        : ["enemy_ghost", "enemy_golem", "enemy_goblin"];
  return (
    floor % 5 === 0
      ? floor % 10 === 5
        ? "boss_dragon"
        : "boss_demon"
      : foes[(wave - 1) % 3]
  ) as ImageKey;
}
function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage may be unavailable */
  }
}
export function GameScreen({ fresh }: { fresh: boolean }) {
  const { t, lang, setLang, codes, langName } = useI18n(),
    { manager, muted, toggleMuted } = useAudio(),
    vp = useViewport(),
    reduced = useReducedMotion();
  const rng = useRef(L.seeded(Date.now())),
    debug = useRef(L.debugFloor(location.search));
  const [state] = useState(() =>
    debug.current
      ? L.newRun(rng.current, debug.current)
      : (!fresh && L.loadSave(read)) || L.newRun(rng.current),
  );
  const s = state,
    st = L.stats(s.levels, s.relics, s.totalShards),
    images = useImages();
  const [, render] = useState(0),
    [modal, setModal] = useState<
      "" | "upgrades" | "settings" | "help" | "rebirth" | "relics"
    >(""),
    [paused, setPaused] = useState(false),
    [max, setMax] = useState(false),
    [announcement, setAnnouncement] = useState(""),
    [feedback, setFeedback] = useState(""),
    [shake, setShake] = useState(() => read("match-hero.shake") !== "0"),
    [reborn, setReborn] = useState(false),
    [numbers, setNumbers] = useState(() => read("match-hero.numbers") !== "0");
  const [coach, setCoach] = useState(() =>
      read("match-hero.coached") === "1" ? -1 : 0,
    ),
    [selected, setSelected] = useState<number | null>(null),
    [busy, setBusy] = useState(false),
    [board, setBoard] = useState([...s.board]),
    [phase, setPhase] = useState(""),
    [affected, setAffected] = useState<number[]>([]),
    [slide, setSlide] = useState<[number, number] | null>(null),
    [toast, setToast] = useState(""),
    [effect, setEffect] = useState("");
  const overlay = useRef<HTMLDivElement>(null),
    visuals = useRef<CombatEffects | null>(null),
    lastAttack = useRef(0),
    [hpTrail, setHpTrail] = useState(s.hp);
  const cells = useRef<(HTMLButtonElement | null)[]>([]),
    pointer = useRef<{ i: number; x: number; y: number } | null>(null),
    suppress = useRef(false),
    alive = useRef(true),
    attackAt = useRef(0),
    hurtAt = useRef(0),
    pauseRef = useRef(false),
    captureAt = useRef<number | null>(null),
    coachRef = useRef(coach);
  pauseRef.current = paused || !!modal;
  coachRef.current = coach;
  const refresh = () => render((n) => n + 1);
  const save = useCallback(() => {
    if (!debug.current) persistRun(s);
  }, [s]);
  const close = useCallback(() => setModal(""), []);
  const announce = (message: string) => {
    setAnnouncement(message);
    setFeedback(message);
  };
  useEffect(() => {
    if (!overlay.current) return;
    const v = new CombatEffects(
      overlay.current,
      images,
      reduced,
      numbers,
      shake,
    );
    visuals.current = v;
    return () => {
      v.dispose();
      visuals.current = null;
    };
  }, [images, reduced, numbers, shake]);
  const events = () => {
    for (const e of L.drainEvents(s)) {
      visuals.current?.event(e);
      if (e.type === "auto") {
        const now = performance.now();
        if (now - lastAttack.current >= 200) {
          attackAt.current = now;
          lastAttack.current = now;
        }
        manager.playSfx(e.crit ? "sfx_crit" : "sfx_hit");
        if (coachRef.current === 0 && s.elapsed > 2) setCoach(1);
      }
      if (e.type === "hurt") {
        hurtAt.current = performance.now();
        manager.playSfx(e.heavy ? "sfx_boss" : "sfx_hurt");
        if (e.heavy && shake && !reduced) navigator.vibrate?.([50, 30, 80]);
        if (s.defeated) {
          manager.playSfx("sfx_defeat");
          setAnnouncement(t("defeatTitle"));
        }
      }
      if (e.type === "kill") {
        manager.playSfx("sfx_kill");
        manager.playSfx("sfx_coin");
      }
      if (e.type === "floor") {
        manager.playSfx(s.floor % 5 === 0 ? "sfx_boss" : "sfx_floor");
        setToast(
          s.floor % 5 === 0 ? t("bossIntro") : t("cleared", { n: s.floor - 1 }),
        );
        setAnnouncement(t("floor", { n: s.floor }));
        setTimeout(() => alive.current && setToast(""), 2400);
      }
    }
  };
  useEffect(() => {
    alive.current = true;
    let raf = 0,
      last = performance.now(),
      acc = 0,
      saved = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!document.hidden && !pauseRef.current && captureAt.current === null) {
        acc += dt;
        if (acc >= 0.025) {
          L.tick(s, acc, rng.current);
          saved += acc;
          acc = 0;
          events();
          if (saved >= 1) {
            saved = 0;
            save();
          }
          render((n) => n + 1);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const persist = () => save();
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", persist);
    return () => {
      alive.current = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", persist);
      save();
    };
  }, [s, save, manager, numbers, t, shake, reduced]);
  useEffect(() => {
    if (s.hp >= hpTrail) {
      setHpTrail(s.hp);
      return;
    }
    const timer = setTimeout(() => setHpTrail(s.hp), 650);
    return () => clearTimeout(timer);
  }, [s.hp, hpTrail]);
  // The debug hook is exposed only for isolated debug adventures / explicit QA.
  useEffect(() => {
    if (!debug.current && !new URLSearchParams(location.search).has("qa"))
      return;
    const target = window as unknown as { __mh?: unknown };
    target.__mh = {
      state: s,
      // QA-only: hold the combat clock/pose while capturing a genuine frame.
      freezeForCapture: () => {
        captureAt.current = performance.now();
      },
      kill: () => {
        L.damage(s, s.enemyHp, "match");
        events();
        refresh();
      },
      match: () => {
        const m = L.possibleMove(s.board);
        if (m) void doSwap(...m);
      },
      set: (values: Partial<L.Run>) => {
        Object.assign(s, values);
        setBoard([...s.board]);
        refresh();
      },
    };
    return () => {
      delete target.__mh;
    };
  });
  useEffect(() => {
    if (coach < 0) return;
    const timer = window.setTimeout(() => {
      setCoach(-1);
      write("match-hero.coached", "1");
    }, 30000);
    return () => clearTimeout(timer);
  }, [coach < 0]);
  useEffect(() => {
    if (s.floor % 5 === 0 && s.elapsed === 0) {
      setToast(t("bossIntro"));
      manager.playSfx("sfx_boss");
      const timer = setTimeout(() => setToast(""), 2400);
      return () => clearTimeout(timer);
    }
  }, [s, manager, t]);
  const cast = useCallback(
    (key: Skill) => {
      if (pauseRef.current) return;
      if (L.useSkill(s, key)) {
        manager.playSfx(
          key === "heal"
            ? "sfx_heal"
            : key === "haste"
              ? "sfx_haste"
              : "sfx_skill",
        );
        events();
        setEffect(key);
        setTimeout(() => alive.current && setEffect(""), 650);
        setCoach(-1);
        write("match-hero.coached", "1");
        save();
        refresh();
      }
    },
    [s, manager, numbers, save, t],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as Element).closest(".modal")) return;
      if (["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        cast(SKILLS[Number(e.key) - 1]);
      }
      if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [cast]);
  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, reduced ? 0 : ms));
  async function doSwap(a: number, b: number) {
    if (busy || paused || modal || s.defeated) return;
    setSelected(null);
    setBusy(true);
    setSlide([a, b]);
    setPhase("swap");
    manager.playSfx("sfx_swap");
    const result = L.swap(s.board, a, b, rng.current);
    await wait(140);
    if (!alive.current) return;
    if (!result.valid) {
      setSlide(null);
      setAffected([a, b]);
      setPhase("invalid");
      announce(t("invalid"));
      manager.playSfx("sfx_invalid");
      await wait(230);
      if (alive.current) {
        setPhase("");
        setBusy(false);
      }
      return;
    }
    setSlide(null);
    let total = 0,
      count = 0;
    for (const cascade of result.cascades) {
      if (s.defeated) break;
      setBoard(cascade.before);
      setPhase("clear");
      setAffected(cascade.cleared);
      visuals.current?.cascade(cascade);
      await wait(450);
      if (!alive.current) return;
      total += L.applyMatch(s, cascade.gems, cascade.combo);
      events();
      count += cascade.gems.length;
      manager.playSfx(cascade.combo > 1 ? "sfx_combo" : "sfx_match");
      setEffect("match");
      refresh();
      await wait(190);
      if (!alive.current) return;
      setBoard(cascade.after);
      setPhase("fall");
      await wait(180);
      if (!alive.current) return;
    }
    s.board = result.board;
    setBoard([...s.board]);
    setBusy(false);
    setPhase("");
    setEffect("");
    setAffected([]);
    setCoach((c) => (c >= 0 ? 2 : -1));
    announce(
      result.reshuffled
        ? t("reshuffle")
        : t("matched", { n: count, d: L.format(total) }),
    );
    save();
    refresh();
  }
  function choose(i: number) {
    if (busy || paused || modal || s.defeated) return;
    if (selected === null) {
      setSelected(i);
      setFeedback(t("select"));
    } else if (selected === i) setSelected(null);
    else if (L.adjacent(selected, i)) void doSwap(selected, i);
    else {
      setSelected(i);
      setFeedback(t("select"));
    }
  }
  function keyboard(e: React.KeyboardEvent<HTMLButtonElement>, i: number) {
    const offset: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -6,
      ArrowDown: 6,
    };
    if (e.key in offset) {
      e.preventDefault();
      const next = i + offset[e.key];
      if (L.adjacent(i, next)) cells.current[next]?.focus();
    }
    if (e.key === "Escape") setSelected(null);
  }
  function endPointer(e: React.PointerEvent, i: number) {
    const start = pointer.current;
    pointer.current = null;
    if (!start) return;
    const dx = e.clientX - start.x,
      dy = e.clientY - start.y;
    if (Math.hypot(dx, dy) > 15) {
      const b =
        i !== start.i
          ? i
          : start.i +
            (Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : -1) : dy > 0 ? 6 : -6);
      if (L.adjacent(start.i, b)) {
        suppress.current = true;
        void doSwap(start.i, b);
      }
    }
  }
  const now = captureAt.current ?? performance.now(),
    attacking = now - attackAt.current < 200,
    frame = attacking
      ? now - attackAt.current < 80
        ? "hero_windup"
        : "hero_slash"
      : Math.floor(s.elapsed * 2) % 2
        ? "hero_idle1"
        : "hero_idle2";
  const stage = Math.floor((s.floor - 1) / 5) % 3,
    boss = s.floor % 5 === 0,
    foe = enemyArt(s.floor, s.wave);
  const hp = (Math.max(0, s.hp) / st.hp) * 100,
    ehp = (Math.max(0, s.enemyHp) / s.enemyMaxHp) * 100,
    charge = L.chargeProgress(s),
    telegraph = charge >= 0.7,
    heavy = L.heavyAttack(s);
  const upgradeValue = (key: Upgrade, v: ReturnType<typeof L.stats>) =>
    key === "speed"
      ? t("perSecond", { n: (1 / v.interval).toFixed(2) })
      : key === "crit"
        ? `${(v.crit * 100).toFixed(1)}%`
        : key === "power"
          ? `×${v.power.toFixed(2)}`
          : key === "gold" || key === "focus"
            ? `+${Math.round((v[key] - 1) * 100)}%`
            : L.format(v[key]);
  const relicValue = (key: Relic, level: number) =>
    key === "boots"
      ? t("startFloor", { n: 1 + Math.floor(level * RELICS[key].step) })
      : `${key === "shield" ? "−" : "+"}${+(level * RELICS[key].step * 100).toFixed(1)}%`;
  const confirmRebirth = () => {
    if (!L.rebirth(s, rng.current)) return;
    visuals.current?.dispose();
    L.drainEvents(s);
    setModal("");
    setSelected(null);
    setBoard([...s.board]);
    setFeedback("");
    setHpTrail(s.hp);
    attackAt.current = 0;
    setReborn(true);
    setTimeout(() => alive.current && setReborn(false), 1000);
    manager.playSfx("sfx_floor");
    setAnnouncement(t("reborn"));
    save();
    refresh();
  };
  const buy = (key: Upgrade) => {
    const n = L.purchase(s, key, max);
    setAnnouncement(
      n ? t("purchased", { name: t(UKEY[key]), n }) : t("noGold"),
    );
    if (n) manager.playSfx("sfx_coin");
    save();
    refresh();
  };
  const layout = vp.h <= 520 || vp.w > vp.h * 1.3 ? "landscape" : "portrait";
  return (
    <main className={`game game--${layout} ${reduced ? "reduced" : ""}`}>
      <div className="game__content" inert={!!modal || s.defeated}>
        <header className="topbar" data-hud="toolbar">
          <div className="floor-gold">
            <h1>{t("floor", { n: s.floor })}</h1>
            <span className="gold">
              <Icon name="coin" />
              <strong data-gold={s.gold}>{L.format(s.gold)}</strong>
            </span>
          </div>
          <nav aria-label={t("settings")}>
            <button
              className="tool"
              aria-label={t("upgrades")}
              onClick={() => setModal("upgrades")}
            >
              <Icon name="upgrade" />
            </button>
            <button
              className="tool"
              aria-label={t("settings")}
              onClick={() => setModal("settings")}
            >
              <Icon name="sound" />
            </button>
            <button
              className="tool"
              aria-label={t(paused ? "resume" : "pause")}
              onClick={() => setPaused((p) => !p)}
            >
              <span
                aria-hidden="true"
                className={paused ? "play-symbol" : "pause-symbol"}
              />
            </button>
            <button
              className="tool"
              aria-label={t("help")}
              onClick={() => {
                setCoach(0);
                setModal("help");
              }}
            >
              <span aria-hidden="true" className="help-symbol" />
            </button>
            <button
              className="tool rebirth-tool"
              data-rebirth
              title={
                L.rebirthReward(s)
                  ? t("rebirthReward", { n: s.best, x: L.rebirthReward(s) })
                  : t("rebirthLocked", { n: REBIRTH_MIN_FLOOR })
              }
              aria-label={`${t("rebirth")} ${L.rebirthReward(s) ? `+${L.rebirthReward(s)}` : t("unlockShort", { n: REBIRTH_MIN_FLOOR })}`}
              onClick={() => setModal("rebirth")}
            >
              <Icon name={L.rebirthReward(s) ? "rebirth" : "lock"} />
              <small>
                {L.rebirthReward(s)
                  ? `+${L.rebirthReward(s)}`
                  : t("unlockShort", { n: REBIRTH_MIN_FLOOR })}
              </small>
            </button>
            <button
              className="tool"
              data-relics
              aria-label={t("relics")}
              onClick={() => setModal("relics")}
            >
              <Icon name="relic_ring" />
            </button>
          </nav>
        </header>
        <section
          className={`battle ${attacking ? "attacking" : ""} ${s.defeated ? "retreat" : ""} ${now - hurtAt.current < 240 ? "hurt" : ""} effect-${effect}`}
          aria-label={t("liveDemo")}
        >
          <div className="enemy-bar" data-hud="enemy">
            <span>
              {t(boss ? "boss" : "wave", { n: s.wave })}
              {telegraph && <Icon name="danger" className="charge-danger" />}
              {paused && (
                <small className="paused-label"> · {t("paused")}</small>
              )}
            </span>
            <span data-enemy-hp={s.enemyHp} data-enemy-max={s.enemyMaxHp}>
              {L.format(s.enemyHp)} / {L.format(s.enemyMaxHp)}
            </span>
            <div
              className="bar enemy-health"
              role="progressbar"
              aria-label={t("enemyHp")}
              aria-valuenow={Math.round(ehp)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${ehp}%` }} />
            </div>{" "}
            <div
              className={`enemy-charge ${telegraph ? "charging-warning" : ""} ${heavy ? "charge-heavy" : ""}`}
              data-hud="charge"
            >
              <span>
                {s.enemyPhase === "entering"
                  ? t("entering")
                  : t(heavy ? "heavyAttack" : "enemyCharge")}
              </span>
              <div
                className="bar charge-bar"
                role="progressbar"
                aria-label={t("enemyCharge")}
                aria-valuenow={Math.floor(charge * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <i style={{ width: `${charge * 100}%` }} />
              </div>
            </div>
          </div>
          <div className={`battle__stage ${""}`}>
            <Art
              name={(["bg_a", "bg_b", "bg_c"] as const)[stage]}
              className="battle__bg"
            />
            <Art
              name={frame}
              className={`hero ${s.haste > 0 ? "hasted" : ""}`}
            />
            {s.enemyPhase !== "empty" && (
              <Art
                key={s.enemyId}
                name={foe}
                className={`enemy enemy-art-${foe} ${boss ? "enemy--boss" : ""} enemy-${s.enemyPhase} ${telegraph ? "telegraph" : ""} ${heavy ? "heavy" : ""}`}
              />
            )}
            {s.burn > 0 && s.enemyPhase === "active" && (
              <Art name="fx_burst" className="burn" />
            )}
            {toast && (
              <div className="floor-toast" role="status">
                {toast}
              </div>
            )}
          </div>

          <div className="hero-health" data-hud="hero">
            <Icon name="heart" />
            <strong>
              {Math.ceil(s.hp)}/{L.format(st.hp)}
            </strong>
            <div
              className="bar hp-bar"
              role="progressbar"
              aria-label={t("health")}
              aria-valuenow={Math.round(hp)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i
                className="hp-trail"
                style={{ width: `${Math.min(100, (hpTrail / st.hp) * 100)}%` }}
              />
              <i style={{ width: `${hp}%` }} />
            </div>
          </div>
        </section>
        <section className="stats" data-hud="stats" aria-label={t("heroStats")}>
          <div className="hero-stats">
            <span>
              {t("atk")} <b data-atk={st.atk}>{L.format(st.atk)}</b>
            </span>
            <span>
              {t("speed")}{" "}
              <b>
                {t("perSecond", {
                  n: ((1 / st.interval) * (s.haste > 0 ? 2 : 1)).toFixed(1),
                })}
              </b>
            </span>
            <span>
              {t("crit")} <b>{Math.round(st.crit * 100)}%</b>
            </span>
            <span>
              {t("hp")} <b>{L.format(st.hp)}</b>
            </span>
            <span>
              {t("dps")}{" "}
              <b>{L.format((st.atk / st.interval) * (1 + st.crit))}</b>
            </span>
            <span
              className="rebirth-stat"
              aria-label={`${t("rebirthStats", { n: s.rebirths, s: s.shards })} · ${t("shardPassive", { n: s.totalShards, p: Math.round(L.shardBonus(s.totalShards) * 100) })}`}
              title={t("shardPassive", { n: s.totalShards, p: Math.round(L.shardBonus(s.totalShards) * 100) })}
            >
              <span>
                <Icon name="rebirth" />
                {L.format(s.rebirths)}
              </span>
              <span>
                <Icon name="sp" />
                {L.format(s.shards)}
              </span>
              <b data-shard-bonus>
                +{Math.round(L.shardBonus(s.totalShards) * 100)}%
              </b>
            </span>
          </div>
          <div className="match-stats" aria-label={t("matchStats")}>
            <span>
              {t("power")} <b>×{st.power.toFixed(2)}</b>
            </span>
            <span className="combo-stat">
              {t("combo")}{" "}
              <b>×{s.combo ? Math.round((s.combo - 1) / 0.25 + 1) : 0}</b>
            </span>
            <span>
              {t("last")}{" "}
              <b data-last={s.lastDamage}>{L.format(s.lastDamage)}</b>
            </span>
          </div>
        </section>
        <section className="skills" data-hud="skills" aria-label={t("sp")}>
          <div className="sp-track">
            <Icon name="sp" />
            <strong data-sp={s.sp}>
              {t("sp")} {Math.floor(s.sp)}/100
            </strong>
            <div
              className="bar sp-bar"
              role="progressbar"
              aria-label={t("sp")}
              aria-valuenow={Math.floor(s.sp)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${s.sp}%` }} />
            </div>
          </div>
          <div className="skill-buttons">
            {SKILLS.map((key, i) => {
              const reason = L.skillReason(s, key);
              return (
                <button
                  key={key}
                  className="skill"
                  data-skill={key}
                  disabled={!!reason || paused}
                  onClick={() => cast(key)}
                >
                  <Icon name={key === "fireball" ? "fire" : key} />
                  <span>
                    {t(key)}{" "}
                    <small>
                      {CONFIG.skills[key].cost} {t("sp")}
                    </small>
                    <em>
                      {reason
                        ? t(reason, { n: Math.ceil(s.cooldowns[key]) })
                        : t("ready")}
                    </em>
                  </span>
                  <kbd>{i + 1}</kbd>
                </button>
              );
            })}
          </div>
        </section>
        <section className="board-area" aria-label={t("board")}>
          <div
            className={`board phase-${phase}`}
            data-busy={busy}
            data-board={s.board.join(",")}
          >
            {board.map((gem, i) => {
              let transform = "";
              if (slide?.includes(i)) {
                const other = slide[0] === i ? slide[1] : slide[0];
                transform = `translate(${((other % 6) - (i % 6)) * 100}%, ${(Math.floor(other / 6) - Math.floor(i / 6)) * 100}%)`;
              }
              return (
                <button
                  key={i}
                  ref={(el) => {
                    cells.current[i] = el;
                  }}
                  data-cell={i}
                  data-gem={gem}
                  className={`gem ${selected === i ? "selected" : ""} ${affected.includes(i) ? "affected" : ""}`}
                  aria-pressed={selected === i}
                  aria-label={t("cell", {
                    gem: t(gem),
                    row: Math.floor(i / 6) + 1,
                    col: (i % 6) + 1,
                  })}
                  onClick={() => {
                    if (suppress.current) {
                      suppress.current = false;
                      return;
                    }
                    choose(i);
                  }}
                  onKeyDown={(e) => keyboard(e, i)}
                  onPointerDown={(e) => {
                    pointer.current = { i, x: e.clientX, y: e.clientY };
                  }}
                  onPointerUp={(e) => endPointer(e, i)}
                  style={{ transform }}
                  disabled={paused || s.defeated}
                >
                  <Art name={`gem_${gem}`} />
                </button>
              );
            })}
          </div>
        </section>
        <aside className="coach" data-hud="coach" aria-live="polite">
          {coach >= 0 ? (
            <>
              <Icon
                name={coach === 0 ? "sword" : coach === 1 ? "coin" : "fire"}
              />
              <p className={feedback === t("invalid") ? "invalid-text" : ""}>
                {feedback === t("invalid") ? feedback : t("coach" + coach)}
              </p>
              <button
                onClick={() => {
                  setCoach(-1);
                  write("match-hero.coached", "1");
                }}
              >
                {t("skip")}
              </button>
            </>
          ) : (
            <p className={feedback === t("invalid") ? "invalid-text" : ""}>
              {feedback || t("coach1")}
            </p>
          )}
        </aside>
      </div>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {modal === "upgrades" && (
        <Modal title={t("upgrades")} onClose={close} panel>
          <p>{t("upgradeHint")}</p>
          <div className="purchase-mode">
            <button aria-pressed={!max} onClick={() => setMax(false)}>
              {t("one")}
            </button>
            <button aria-pressed={max} onClick={() => setMax(true)}>
              {t("max")}
            </button>
            <strong>
              <Icon name="coin" />
              {L.format(s.gold)}
            </strong>
          </div>
          <div className="upgrade-list">
            {UPGRADES.map((key) => {
              const p = L.purchasePreview(s, key, max),
                capped = s.levels[key] >= CONFIG.upgrades[key].cap;
              return (
                <div className="upgrade-row" key={key}>
                  <Icon
                    name={
                      key === "atk"
                        ? "sword"
                        : key === "speed"
                          ? "haste"
                          : key === "hp"
                            ? "heart"
                            : key === "gold"
                              ? "coin"
                              : key === "focus"
                                ? "sp"
                                : "upgrade"
                    }
                  />
                  <div className="upgrade-copy">
                    <b>{t(UKEY[key])}</b>
                    <small>{t("level", { n: s.levels[key] })}</small>
                    <p>{t(`upgradeDesc_${key}`)}</p>
                    <strong className="value-preview">
                      {capped
                        ? t("capped")
                        : `${upgradeValue(key, st)} → ${upgradeValue(key, p.after)}`}
                    </strong>
                  </div>
                  <button
                    data-upgrade={key}
                    disabled={!p.n}
                    onClick={() => buy(key)}
                  >
                    {t(capped ? "capped" : "buy")}
                    {!capped && (
                      <>
                        <small>
                          +{p.n || 1} {t("levels")}
                        </small>
                        <strong>{L.format(p.cost)}</strong>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
          <p role="status" aria-live="polite">
            {announcement || t("best", { n: s.bestEver })}
          </p>
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title={t("settings")} onClose={close}>
          <div className="settings-list">
            <button onClick={toggleMuted}>
              {t(muted ? "soundOff" : "soundOn")}
            </button>
            <label>
              {t("language")}
              <select
                aria-label={t("language")}
                value={lang}
                onChange={(e) => setLang(e.target.value as typeof lang)}
              >
                {codes.map((c) => (
                  <option key={c} value={c}>
                    {langName(c)}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={() => {
                setNumbers((v) => {
                  write("match-hero.numbers", v ? "0" : "1");
                  return !v;
                });
              }}
            >
              {t(numbers ? "numbersOn" : "numbersOff")}
            </button>
            <button
              onClick={() =>
                setShake((v) => {
                  write("match-hero.shake", v ? "0" : "1");
                  return !v;
                })
              }
            >
              {t(shake ? "shakeOn" : "shakeOff")}
            </button>
            <p>{t("best", { n: s.bestEver })}</p>
            <p data-shard-passive>{t("shardPassive", { n: s.totalShards, p: Math.round(L.shardBonus(s.totalShards) * 100) })}</p>
            <CatalogLink onSave={() => {
              pauseRef.current = true;
              if (!s.defeated) save();
            }} />
          </div>
        </Modal>
      )}
      {modal === "rebirth" && (
        <Modal title={t("rebirth")} onClose={close}>
          <p>{t("rebirthReward", { n: s.best, x: L.rebirthReward(s) })}</p>
          <p>{t("rebirthReset")}</p>
          <p>{t("rebirthKeep")}</p>
          <p data-shard-passive>{t("shardPassive", { n: s.totalShards, p: Math.round(L.shardBonus(s.totalShards) * 100) })}</p>
          <p>{t("shardPassiveNext", { p: Math.round(L.shardBonus(s.totalShards + L.rebirthReward(s)) * 100) })}</p>
          {!L.rebirthReward(s) && (
            <p>{t("rebirthLocked", { n: REBIRTH_MIN_FLOOR })}</p>
          )}
          <div className="confirm-actions">
            <button
              className="primary"
              data-confirm-rebirth
              disabled={!L.rebirthReward(s) || busy}
              onClick={confirmRebirth}
            >
              {t("confirmRebirth")}
            </button>
            <button onClick={close}>{t("cancel")}</button>
          </div>
        </Modal>
      )}
      {modal === "relics" && (
        <Modal title={t("relics")} onClose={close} panel>
          <p>{t("shardsOwned", { n: s.shards })}</p>
          <p data-shard-passive>{t("shardPassive", { n: s.totalShards, p: Math.round(L.shardBonus(s.totalShards) * 100) })}</p>
          <div className="relic-list">
            {(Object.keys(RELICS) as Relic[]).map((key) => {
              const r = RELICS[key],
                level = s.relics[key] ?? 0,
                cost = L.relicCost(key, level),
                capped = level >= r.cap;
              return (
                <div className="upgrade-row" key={key}>
                  <Icon name={r.icon} />
                  <div className="upgrade-copy">
                    <b>{t(`relic_${key}`)}</b>
                    <small>
                      {t("level", { n: level })} / {r.cap}
                    </small>
                    <p>{t(`relicDesc_${key}`)}</p>
                    <strong className="value-preview">
                      {capped
                        ? t("capped")
                        : `${relicValue(key, level)} → ${relicValue(key, level + 1)}`}
                    </strong>
                  </div>
                  <button
                    data-relic={key}
                    disabled={s.shards < cost}
                    onClick={() => {
                      if (L.purchaseRelic(s, key)) {
                        manager.playSfx("sfx_coin");
                        save();
                        refresh();
                      }
                    }}
                  >
                    {t(capped ? "capped" : level ? "buy" : "unlock")}
                    {!capped && <strong>{t("shardCost", { n: cost })}</strong>}
                  </button>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title={t("help")} onClose={close}>
          <p className="help-text">{t("helpText")}</p>
        </Modal>
      )}
      {s.defeated && (
        <Modal title={t("defeatTitle")} closable={false} onClose={close}>
          <p>{t("defeatText", { n: s.floor })}</p>
          <button
            className="primary"
            onClick={() => {
              s.defeated = false;
              save();
              refresh();
            }}
          >
            {t("continue")}
          </button>
        </Modal>
      )}
      <div ref={overlay} className="combat-overlay" aria-hidden="true" />
      {reborn && (
        <div className="rebirth-flash" role="status">
          {t("reborn")}
        </div>
      )}
    </main>
  );
}
