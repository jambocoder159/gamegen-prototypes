// The Upgrades dialog: the 8 numeric pot-upgrade lines plus plot expansion. Each
// row shows name, level, an effect line with live numbers, and a cost button with
// the dew icon (dimmed, with the shortfall as the reason, when unaffordable). A
// ×1 / Max toggle switches how many levels the cost button buys at once. Purchase
// results are announced through the dialog's polite live region.

import { useState } from 'react';
import { useI18n } from '../../i18n';
import { formatNumber } from '../format';
import {
  UPGRADES,
  U,
  WARMTH_PER_LEVEL,
  FERT_PER_LEVEL,
  MERGE_BURST_PER_LEVEL,
  PLOT_COUNT,
} from '../config';
import { Dialog } from './Dialog';
import { buyUpgrade as quoteUpgrade } from '../upgrades';
import { Button } from './Button';
import { Art } from './Art';
import type { UseGarden } from '../useGarden';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function effectText(index: number, level: number, g: UseGarden, t: (k: string, p?: Record<string, string | number>) => string): string {
  const key = UPGRADES[index].key;
  const d = g.d;
  switch (index) {
    case U.power:
      return t('upgrade.power.effect', { value: formatNumber(d.clickValue) });
    case U.warmth:
      return t('upgrade.warmth.effect', { value: pct(WARMTH_PER_LEVEL * level) });
    case U.crit:
      return t('upgrade.crit.effect', { value: pct(d.critChance) });
    case U.critPower:
      return t('upgrade.critPower.effect', { value: d.critPower.toFixed(2) });
    case U.auto:
      return t('upgrade.auto.effect', { value: d.autoRate.toFixed(1) });
    case U.fert:
      return t('upgrade.fert.effect', { value: (1 + FERT_PER_LEVEL * level).toFixed(2) });
    case U.merge:
      return t('upgrade.merge.effect', { value: (1 + MERGE_BURST_PER_LEVEL * level).toFixed(2) });
    case U.seed:
      return t('upgrade.seed.effect', { value: pct(d.seedQualityChance) });
    default:
      return key;
  }
}

function Row({
  name,
  level,
  effect,
  cost,
  atMax,
  affordable,
  shortfall,
  maxText,
  onBuy,
  costLabel,
}: {
  name: string;
  level: string;
  effect: string;
  cost: number;
  atMax: boolean;
  affordable: boolean;
  shortfall: number;
  maxText: string;
  onBuy: () => void;
  costLabel: string;
}) {
  const { t } = useI18n();
  return (
    <li className="urow">
      <div className="urow__info">
        <div className="urow__top">
          <span className="urow__name">{name}</span>
          <span className="urow__level">{level}</span>
        </div>
        <span className="urow__effect">{effect}</span>
      </div>
      {atMax ? (
        <span className="urow__max">{maxText}</span>
      ) : (
        <Button
          className="btn btn--cost urow__buy"
          onClick={onBuy}
          dimmed={!affordable}
          ariaLabel={
            costLabel + (affordable ? '' : '. ' + t('upgrade.needMore', { value: formatNumber(shortfall) }))
          }
        >
          <Art imgKey="iconDew" alt="" className="btn__dew" />
          <span className="btn__cost-n">{formatNumber(cost)}</span>
        </Button>
      )}
    </li>
  );
}

export function UpgradesDialog({ g, onClose }: { g: UseGarden; onClose: () => void }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'one' | 'max'>('one');
  const [live, setLive] = useState('');

  const buy = (index: number) => {
    const name = t(`upgrade.${UPGRADES[index].key}.name`);
    const res = g.buyUpgrade(index, mode);
    if (res.ok) setLive(t('upgrade.bought', { name, level: g.snap.upgrades[index] + res.bought }));
    else setLive(t('upgrade.cantAfford', { name }));
  };

  const buyPlot = () => {
    const ok = g.buyPlot();
    setLive(ok ? t('upgrade.plotBought', { n: g.snap.unlocked + 1 }) : t('upgrade.cantAfford', { name: t('upgrade.plots.name') }));
  };

  const d = g.d;

  return (
    <Dialog
      title={t('upgrade.title')}
      onClose={onClose}
      live={live}
      className="dialog--upgrades"
      titleIcon={<Art imgKey="iconUpgrade" alt="" className="dialog__title-icon" />}
    >
      <div className="udlg__toggle" role="group" aria-label={t('upgrade.amountLabel')}>
        <Button
          className={`seg${mode === 'one' ? ' seg--on' : ''}`}
          ariaPressed={mode === 'one'}
          onClick={() => setMode('one')}
        >
          {t('upgrade.buyOne')}
        </Button>
        <Button
          className={`seg${mode === 'max' ? ' seg--on' : ''}`}
          ariaPressed={mode === 'max'}
          onClick={() => setMode('max')}
        >
          {t('upgrade.buyMax')}
        </Button>
      </div>

      <ul className="urows">
        {d.upgrades.map((v) => {
          const name = t(`upgrade.${UPGRADES[v.index].key}.name`);
          const quote = mode === 'max' && !v.atMax ? quoteUpgrade(g.snap, v.index, mode).spent : 0;
          const cost = quote || v.cost;
          const affordable = cost <= g.snap.dew;
          return (
            <Row
              key={v.index}
              name={name}
              level={t('upgrade.level', { level: v.level })}
              effect={effectText(v.index, v.level, g, t)}
              cost={cost}
              atMax={v.atMax}
              affordable={affordable}
              shortfall={Math.max(0, cost - g.snap.dew)}
              maxText={t('upgrade.maxed')}
              onBuy={() => buy(v.index)}
              costLabel={t('upgrade.buyCost', { name, value: formatNumber(cost) })}
            />
          );
        })}

        {/* plot expansion (upgrade line #9) */}
        <li className="urow urow--plot">
          <div className="urow__info">
            <div className="urow__top">
              <span className="urow__name">{t('upgrade.plots.name')}</span>
              <span className="urow__level">{g.snap.unlocked} / {PLOT_COUNT}</span>
            </div>
            <span className="urow__effect">{t('upgrade.plots.effect')}</span>
          </div>
          {g.snap.unlocked >= PLOT_COUNT ? (
            <span className="urow__max">{t('upgrade.maxed')}</span>
          ) : (
            <Button
              className="btn btn--cost urow__buy"
              onClick={buyPlot}
              dimmed={d.nextPlotCost > g.snap.dew}
              ariaLabel={
                d.nextPlotCost <= g.snap.dew
                  ? t('upgrade.buyCost', { name: t('upgrade.plots.name'), value: formatNumber(d.nextPlotCost) })
                  : t('upgrade.needMore', { value: formatNumber(d.nextPlotCost - g.snap.dew) })
              }
            >
              <Art imgKey="iconLock" alt="" className="btn__dew" />
              <span className="btn__cost-n">{formatNumber(d.nextPlotCost)}</span>
            </Button>
          )}
        </li>
      </ul>
    </Dialog>
  );
}
