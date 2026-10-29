// The Relics dialog: sun-coin balance, a Draw button (random relic for 8 coins),
// a 12-card codex grid (owned cards show the icon + level; unowned show a lock and
// a buy-unlock button for 20 coins), and a detail panel for the selected relic
// with its effect and an upgrade button. Results are announced via the live region.

import { useState } from 'react';
import { useI18n } from '../../i18n';
import { formatNumber } from '../format';
import { RELICS, R, relicUpgradeCost, DRAW_COST, UNLOCK_COST } from '../config';
import { relicFx } from '../relics';
import { relicImageKey } from '../../config/assets';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Art } from './Art';
import type { UseGarden } from '../useGarden';

const pct = (x: number) => `${Math.round(x)}%`;

/** Effect line for a relic at a given level (level 0 previews level 1). */
function relicEffect(
  index: number,
  level: number,
  t: (k: string, p?: Record<string, string | number>) => string,
): string {
  const L = Math.max(1, level);
  const key = RELICS[index].key;
  switch (index) {
    case R.lens: return t('relic.lens.effect', { value: relicFx.lensMult(L).toFixed(2) });
    case R.sun: return t('relic.sun.effect', { value: relicFx.sunMult(L).toFixed(2) });
    case R.moon: return t('relic.moon.effect', { rate: pct((relicFx.offlineRate(L) - 0.5) * 100), cap: (relicFx.offlineCapSec(L) - relicFx.offlineCapSec(0)) / 60 });
    case R.bee: return t('relic.bee.effect', { value: relicFx.beeMult(L).toFixed(2) });
    case R.clover: return t('relic.clover.effect', { value: pct(relicFx.cloverChance(L) * 100) });
    case R.thunder: return t('relic.thunder.effect', { value: relicFx.thunderPower(L).toFixed(2) });
    case R.trowel: return t('relic.trowel.effect', { value: pct(relicFx.trowelDiscount(L) * 100) });
    case R.cloud: return t('relic.cloud.effect', { value: relicFx.cloudRate(L).toFixed(1) });
    case R.lotus: return t('relic.lotus.effect', { value: relicFx.lotusMult(L).toFixed(2) });
    case R.ladybug: return t('relic.ladybug.effect', { value: pct(relicFx.ladybugChance(L) * 100) });
    case R.can: return t('relic.can.effect', { value: pct(relicFx.canDiscount(L) * 100) });
    case R.acorn: return t('relic.acorn.effect', { value: formatNumber(relicFx.acornDew(L)) });
    default: return key;
  }
}

export function RelicsDialog({ g, onClose }: { g: UseGarden; onClose: () => void }) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<number | null>(null);
  const [live, setLive] = useState('');
  const [drawCount, setDrawCount] = useState(0);
  const relics = g.snap.relics;
  const coins = g.snap.sunCoins;

  const draw = () => {
    const res = g.drawRelic();
    if (!res.ok) {
      setLive(t('relic.needCoins'));
      return;
    }
    setDrawCount(count => count + 1);
    setSelected(res.index);
    const name = t(`relic.${RELICS[res.index].key}.name`);
    setLive(
      res.newlyOwned
        ? t('relic.drewNew', { name })
        : t('relic.drewUp', { name, level: res.level }),
    );
  };

  const buyUnlock = (index: number) => {
    const ok = g.buyRelic(index);
    setLive(ok ? t('relic.unlocked', { name: t(`relic.${RELICS[index].key}.name`) }) : t('relic.needCoins'));
  };

  const upgrade = (index: number) => {
    const ok = g.upgradeRelic(index);
    setLive(
      ok
        ? t('relic.upgraded', { name: t(`relic.${RELICS[index].key}.name`), level: relics[index] + 1 })
        : t('relic.needCoins'),
    );
  };

  const sel = selected;
  const selLevel = sel != null ? relics[sel] : 0;
  const selOwned = sel != null && selLevel > 0;
  const selAtMax = sel != null && selLevel >= RELICS[sel].max;
  const selUpCost = sel != null && selOwned && !selAtMax ? relicUpgradeCost(sel, selLevel) : Infinity;

  return (
    <Dialog
      title={t('relic.title')}
      onClose={onClose}
      live={live}
      className="dialog--relics"
      titleIcon={<Art imgKey="iconChest" alt="" className="dialog__title-icon" />}
    >
      <div className="rdlg__bar">
        <span className="rdlg__coins">
          <Art imgKey="iconSuncoin" alt="" className="rdlg__coin-icon" />
          <span className="rdlg__coin-n">{formatNumber(coins)}</span>
          <span className="sr-only">{t('relic.coins')}</span>
        </span>
        <Button
          className="btn btn--primary rdlg__draw"
          onClick={draw}
          dimmed={coins < DRAW_COST}
          title={t('relic.drawCost', { value: DRAW_COST })}
        >
          <Art key={drawCount} imgKey="iconChest" alt="" className={`rdlg__draw-icon${drawCount ? " rdlg__draw-icon--pop" : ""}`} />
          <span className="rdlg__draw-label">{t('relic.draw')}</span>
          <span className="rdlg__draw-cost">
            <Art imgKey="iconSuncoin" alt="" className="btn__dew" />
            {DRAW_COST}<span className="sr-only">{t('relic.coins')}</span>
          </span>
        </Button>
      </div>

      <ul className="codex" aria-label={t('relic.codex')}>
        {RELICS.map((def, i) => {
          const lvl = relics[i];
          const owned = lvl > 0;
          const name = t(`relic.${def.key}.name`);
          return (
            <li key={def.key} className="codex__cell">
              <Button
                className={`codex__card${owned ? '' : ' codex__card--locked'}${selected === i ? ' codex__card--sel' : ''}`}
                ariaPressed={selected === i}
                ariaLabel={owned ? t('relic.ownedCard', { name, level: lvl }) : t('relic.lockedCard', { name })}
                onClick={() => setSelected(i)}
              >
                <Art imgKey={owned ? relicImageKey(i) : 'iconLock'} alt="" className="codex__img" />
                {owned && <span className="codex__lvl">{lvl}</span>}
              </Button>
              {!owned && <Button className="btn codex__unlock" dimmed={coins < UNLOCK_COST}
                ariaLabel={t('relic.buyCard', { name, value: UNLOCK_COST })} onClick={() => { setSelected(i); buyUnlock(i); }}>
                <Art imgKey="iconSuncoin" alt="" className="btn__dew" />{UNLOCK_COST}
              </Button>}
            </li>
          );
        })}
      </ul>

      <div className="rdetail" aria-live="off">
        {sel == null ? (
          <p className="rdetail__hint">{t('relic.pickHint')}</p>
        ) : (
          <>
            <div className="rdetail__head">
              <Art
                imgKey={selOwned ? relicImageKey(sel) : 'iconLock'}
                alt=""
                className="rdetail__img"
              />
              <div className="rdetail__meta">
                <span className="rdetail__name">{t(`relic.${RELICS[sel].key}.name`)}</span>
                <span className="rdetail__level">
                  {selOwned ? t('relic.level', { level: selLevel }) : t('relic.notOwned')}
                </span>
              </div>
            </div>
            <p className="rdetail__desc">{t(`relic.${RELICS[sel].key}.desc`)}</p>
            <p className="rdetail__effect">{relicEffect(sel, selLevel, t)}</p>
            {!selOwned ? (
              <Button
                className="btn btn--primary rdetail__action"
                onClick={() => buyUnlock(sel)}
                dimmed={coins < UNLOCK_COST}
              >
                <Art imgKey="iconSuncoin" alt="" className="btn__dew" />
                {t('relic.unlock', { value: UNLOCK_COST })}
              </Button>
            ) : selAtMax ? (
              <span className="rdetail__max">{t('relic.maxed')}</span>
            ) : (
              <Button
                className="btn btn--primary rdetail__action"
                onClick={() => upgrade(sel)}
                dimmed={coins < selUpCost}
              >
                <Art imgKey="iconSuncoin" alt="" className="btn__dew" />
                {t('relic.upgradeTo', { level: selLevel + 1, value: selUpCost })}
              </Button>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
