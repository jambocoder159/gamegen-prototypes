import type { ImageKey } from "../config/assets";
import type { Cascade, CombatEvent } from "./logic";
import { format } from "./logic";

// Bounded, decorative DOM. All coordinates come from the rendered layout; no
// viewport assumptions or React children are mixed into the effect layer.
export class CombatEffects {
  private nodes = new Set<HTMLElement>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private animations = new Set<Animation>();
  constructor(
    private root: HTMLElement,
    private images: Record<ImageKey, string | null>,
    private reduced: boolean,
    private numbers: boolean,
    private shake: boolean,
  ) {}
  private later(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      this.timers.delete(id);
      fn();
    }, ms);
    this.timers.add(id);
  }
  private center(selector: string) {
    const r = document.querySelector(selector)?.getBoundingClientRect();
    return r ? { x: r.x + r.width / 2, y: r.y + r.height * 0.5 } : null;
  }
  private animate(
    el: HTMLElement,
    frames: Keyframe[],
    duration: number,
    delay = 0,
  ) {
    const a = el.animate(frames, {
      duration,
      delay,
      easing: "ease-out",
      fill: "both",
    });
    this.animations.add(a);
    a.onfinish = () => {
      this.animations.delete(a);
      this.nodes.delete(el);
      el.remove();
    };
    return a;
  }
  private node(el: HTMLElement, x: number, y: number) {
    if (this.nodes.size >= 24) {
      const old = this.nodes.values().next().value;
      if (old) {
        old.getAnimations().forEach((a) => {
          a.cancel();
          this.animations.delete(a);
        });
        old.remove();
        this.nodes.delete(old);
      }
    }
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.root.append(el);
    this.nodes.add(el);
    return el;
  }
  private sprite(
    name: ImageKey,
    x: number,
    y: number,
    size = 64,
    duration = 240,
  ) {
    const src = this.images[name];
    if (!src) return;
    const el = document.createElement("img");
    el.src = src;
    el.alt = "";
    el.draggable = false;
    el.className = "combat-fx";
    el.style.width = el.style.height = `${size}px`;
    this.node(el, x - size / 2, y - size / 2);
    this.animate(
      el,
      this.reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            {
              opacity: 1,
              transform: `scale(.65) rotate(${Math.round(Math.random() * 20 - 10)}deg)`,
            },
            { opacity: 0, transform: "scale(1.25)" },
          ],
      duration,
    );
  }
  private text(
    amount: number,
    kind: string,
    hero = false,
    label = "",
    combo = 1,
  ) {
    if (!this.numbers) return;
    const p = this.center(hero ? ".hero" : ".enemy");
    if (!p) return;
    const el = document.createElement("span");
    el.className = `damage-number damage-${kind}`;
    if (combo > 1)
      el.style.fontSize = `${Math.min(42, 32 + (combo - 1) * 4)}px`;
    el.textContent =
      label ||
      `${hero && kind === "hurt" ? "−" : kind === "heal" || kind === "gold" ? "+" : ""}${format(amount)}`;
    this.node(el, p.x + (Math.random() - 0.5) * 25, p.y);
    this.animate(
      el,
      this.reduced
        ? [{ opacity: 1 }, { opacity: 0 }]
        : [
            { opacity: 1, transform: "translate(-50%,0) scale(1.15)" },
            { opacity: 0, transform: "translate(-50%,-50px) scale(1)" },
          ],
      850,
    );
  }
  private move(selector: string, frames: Keyframe[], duration: number) {
    if (this.reduced) return;
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    const a = el.animate(frames, { duration, easing: "ease-out" });
    this.animations.add(a);
    a.onfinish = () => this.animations.delete(a);
  }
  private flash(selector: string) {
    const el = document.querySelector<HTMLElement>(selector);
    if (!el) return;
    const a = el.animate(
      [
        { filter: "brightness(3) saturate(0)" },
        { filter: "brightness(1) saturate(1)" },
      ],
      { duration: 100 },
    );
    this.animations.add(a);
    a.onfinish = () => this.animations.delete(a);
  }
  pulse(selector: string) {
    this.flash(selector);
    if (!this.reduced)
      this.move(
        selector,
        [
          { transform: "scale(1)" },
          { transform: "scale(1.08)" },
          { transform: "scale(1)" },
        ],
        240,
      );
  }
  private impact(name: ImageKey = "fx_spark", hero = false, big = false) {
    const p = this.center(hero ? ".hero" : ".enemy");
    if (p) this.sprite(name, p.x, p.y, big ? 110 : 70);
    if (!hero) {
      this.flash(".enemy");
      this.move(
        ".enemy",
        [{ translate: "0 0" }, { translate: "8px 0" }, { translate: "0 0" }],
        150,
      );
    }
  }
  private screenShake(big = false) {
    if (this.shake && !this.reduced)
      this.move(
        ".battle__stage",
        [
          { translate: "0 0" },
          { translate: `${big ? 4 : 1}px -1px` },
          { translate: `-${big ? 4 : 1}px 1px` },
          { translate: "0 0" },
        ],
        180,
      );
  }
  event(e: CombatEvent) {
    switch (e.type) {
      case "auto": {
        this.lunge(".hero", ".enemy", false);
        this.later(
          () => {
            this.impact(e.crit ? "fx_slash_crit" : "fx_slash", false, !!e.crit);
            this.impact();
            this.text(
              e.amount,
              e.crit ? "crit" : "auto",
              false,
              e.crit ? `CRIT! ${format(e.amount)}` : "",
            );
            this.screenShake(!!e.crit);
            this.hitstop();
          },
          this.reduced ? 0 : 80,
        );
        break;
      }
      case "hurt":
        this.lunge(".enemy", ".hero", true);
        this.impact(
          "fx_claw",
          true,
          !!e.heavy || !!document.querySelector(".enemy--boss"),
        );
        this.flash(".hero");
        this.move(
          ".hero",
          [{ translate: "0 0" }, { translate: "-6px 0" }, { translate: "0 0" }],
          220,
        );
        this.text(e.amount, "hurt", true);
        this.screenShake(!!e.heavy);
        break;
      case "burn":
        this.impact("fx_burst");
        this.text(e.amount, "burn");
        break;
      case "match":
        this.impact(
          e.gem === "fire" ? "fx_burst" : "fx_spark",
          false,
          (e.combo ?? 1) > 1,
        );
        this.text(
          e.amount,
          e.gem === "fire" ? "match" : "auto",
          false,
          "",
          e.combo ?? 1,
        );
        this.screenShake((e.combo ?? 1) > 1);
        break;
      case "heal":
        this.impact("fx_heal", true);
        this.text(e.amount, "heal", true);
        if (!this.reduced) {
          const p = this.center(".hero");
          if (p)
            for (let i = 0; i < 3; i++)
              this.sprite("fx_heal", p.x + (i - 1) * 20, p.y + 15, 20, 400);
        }
        break;
      case "gold":
        this.pulse(".gold");
        this.text(e.amount, "gold");
        break;
      case "fireball":
        this.projectile("fx_fireball", ".hero", ".enemy", 350, () => {
          this.impact("fx_burst", false, true);
          this.text(e.amount, "fireball");
          this.screenShake(true);
        });
        break;
      case "kill":
        {
          const p = this.center(".enemy");
          if (p)
            for (let i = 0; i < 5; i++) {
              const src = this.images.icon_coin;
              if (!src) continue;
              const el = document.createElement("img");
              el.src = src;
              el.alt = "";
              el.draggable = false;
              el.className = "combat-fx";
              el.style.width = el.style.height = "22px";
              this.node(el, p.x, p.y);
              this.animate(
                el,
                this.reduced
                  ? [{ opacity: 1 }, { opacity: 0 }]
                  : [
                      { opacity: 1, transform: "translate(0,0)" },
                      {
                        opacity: 1,
                        transform: `translate(${(i - 2) * 20}px,-40px)`,
                      },
                      {
                        opacity: 0,
                        transform: `translate(${(i - 2) * 35}px,25px)`,
                      },
                    ],
                450,
              );
            }
        }
        break;
      case "rebirth":
        this.pulse(".game");
        break;
    }
  }
  private hitstop() {
    if (this.reduced) return;
    const els = document.querySelectorAll(".hero,.enemy");
    const animations = [...els]
      .flatMap((el) => el.getAnimations())
      .filter((a) => a.playState === "running");
    animations.forEach((a) => a.pause());
    this.later(
      () =>
        animations.forEach((a) => {
          if (a.playState === "paused") a.play();
        }),
      45,
    );
  }
  private lunge(from: string, to: string, enemy: boolean) {
    if (this.reduced) return;
    const a = document.querySelector(from)?.getBoundingClientRect(),
      b = document.querySelector(to)?.getBoundingClientRect();
    if (!a || !b) return;
    const gap = enemy ? a.left - b.right : b.left - a.right;
    const distance = Math.max(0, gap) * 0.35 * (enemy ? -1 : 1);
    this.move(
      from,
      [
        { translate: "0 0", offset: 0 },
        { translate: `${distance}px 0`, offset: enemy ? 0.45 : 0.6 },
        { translate: "0 0", offset: 1 },
      ],
      enemy ? 150 : 200,
    );
  }
  projectile(
    name: ImageKey,
    from: string,
    to: string,
    duration: number,
    done: () => void,
  ) {
    const a = this.center(from),
      b = this.center(to);
    if (!a || !b) {
      done();
      return;
    }
    if (this.reduced) {
      done();
      return;
    }
    const src = this.images[name];
    if (!src) {
      done();
      return;
    }
    const el = document.createElement("img");
    el.src = src;
    el.alt = "";
    el.draggable = false;
    el.className = "combat-fx";
    el.style.width = el.style.height = "60px";
    this.node(el, a.x - 30, a.y - 30);
    this.animate(
      el,
      [
        { transform: "translate(0,0)" },
        { transform: `translate(${b.x - a.x}px,${b.y - a.y}px)` },
      ],
      duration,
    );
    this.later(done, duration);
  }
  cascade(c: Cascade) {
    c.cleared.slice(0, 24).forEach((index, i) => {
      const gem = c.before[index],
        target =
          gem === "mana"
            ? ".sp-track"
            : gem === "heart"
              ? ".hero"
              : gem === "coin"
                ? ".gold"
                : ".enemy";
      const a = this.center(`[data-cell="${index}"]`),
        b = this.center(target);
      if (!a || !b) return;
      if (gem === "star") {
        for (const n of c.cleared) {
          if (
            Math.abs((n % 6) - (index % 6)) <= 1 &&
            Math.abs(Math.floor(n / 6) - Math.floor(index / 6)) <= 1
          ) {
            const p = this.center(`[data-cell="${n}"]`);
            if (p) this.sprite("fx_burst", p.x, p.y, 45, 350);
          }
        }
      }
      if (this.reduced) {
        if (gem === "mana" || gem === "coin") {
          this.pulse(target);
          if (gem === "mana") {
            const p = this.center(target);
            if (p) this.sprite("fx_orb", p.x, p.y, 32, 180);
          }
        }
        return;
      }
      const src = this.images[`gem_${gem}`];
      if (!src) return;
      const el = document.createElement("img");
      el.src = src;
      el.alt = "";
      el.draggable = false;
      el.className = "gem-flight";
      this.node(el, a.x - 14, a.y - 14);
      const dx = b.x - a.x,
        dy = b.y - a.y;
      this.animate(
        el,
        [
          { transform: "translate(0,0) scale(1)", opacity: 1 },
          {
            transform: `translate(${dx * 0.45}px,${dy * 0.5 - 70}px) scale(.85)`,
            opacity: 1,
            offset: 0.5,
          },
          { transform: `translate(${dx}px,${dy}px) scale(.3)`, opacity: 0 },
        ],
        450,
        i * 40,
      );
      this.later(
        () => {
          if (gem === "mana" || gem === "coin") {
            this.pulse(target);
            if (gem === "mana") {
              const p = this.center(target);
              if (p) this.sprite("fx_orb", p.x, p.y, 32, 180);
            }
          } else if (gem === "heart") this.impact("fx_heal", true);
          else
            this.impact(
              gem === "fire" || gem === "star" ? "fx_burst" : "fx_spark",
            );
        },
        450 + i * 40,
      );
    });
  }
  dispose() {
    this.timers.forEach(clearTimeout);
    this.animations.forEach((a) => a.cancel());
    this.nodes.forEach((el) => el.remove());
    this.timers.clear();
    this.animations.clear();
    this.nodes.clear();
  }
}
