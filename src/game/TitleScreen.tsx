// Title screen: the real game plays itself behind the logo — a bot that deals
// stage 1 with the real logic, finds any valid free pair, removes it after a
// short delay and re-deals when the stack is clear, endlessly. No HUD, no sfx.
// Logo + localised title on top, Play + language + sound at the bottom, with the
// dealer mascot. Under reduced motion the board is shown static (no ambient loop).
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import type { Layout } from '../platform/layout';
import { findMatch, generateDeal, type Tile } from './logic';
import { getStage } from './layouts';
import { BoardView } from './components/BoardView';
import { Button } from './components/Button';
import { LanguageControl, SoundControl } from './components/Controls';
import { Dealer } from './components/Dealer';
import { Art } from './components/Art';

const STEP_MS = 850;
const REDEAL_MS = 1500;

function deal(seed: number): Tile[] {
  const stage = getStage(0);
  return (
    generateDeal(stage.positions, stage.K, seed) ??
    stage.positions.map((p, id) => ({ ...p, id, type: 0, removed: false }))
  );
}

export function TitleScreen({
  layout,
  reduced,
  onPlay,
}: {
  layout: Layout;
  reduced: boolean;
  onPlay: () => void;
}) {
  const { t } = useI18n();
  const seedRef = useRef(1);
  const tilesRef = useRef<Tile[]>(deal(seedRef.current));
  const [tiles, setTiles] = useState<Tile[]>(() => tilesRef.current);
  const [cheer, setCheer] = useState(0);

  useEffect(() => {
    if (reduced) return; // no continuous ambient movement under reduced motion
    let timer = 0;
    const schedule = (ms: number) => {
      timer = window.setTimeout(tick, ms);
    };
    const tick = () => {
      const cur = tilesRef.current;
      const match = findMatch(cur);
      if (!match) {
        seedRef.current += 1;
        tilesRef.current = deal(seedRef.current);
        setTiles(tilesRef.current);
        schedule(REDEAL_MS);
        return;
      }
      const next = cur.map((o) =>
        o.id === match[0] || o.id === match[1] ? { ...o, removed: true } : o,
      );
      tilesRef.current = next;
      setTiles(next);
      setCheer((c) => c + 1);
      schedule(STEP_MS);
    };
    schedule(STEP_MS);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  return (
    <div className={`title title--${layout}`}>
      <div className="title__demo" aria-hidden="true">
        <BoardView
          tiles={tiles}
          selected={null}
          hint={null}
          interactive={false}
          reduced={reduced}
        />
      </div>
      <div className="title__vignette" aria-hidden="true" />
      <div className="title__content">
        <div className="title__head">
          <Art imgKey="logo" alt="" className="title__logo" />
          <h1 className="title__name">{t('game.title')}</h1>
          <p className="title__tagline">{t('game.tagline')}</p>
        </div>
        <div className="title__actions">
          <Dealer cheer={cheer} reduced={reduced} className="title__dealer" />
          <Button className="btn btn--primary btn--play" onClick={onPlay}>
            {t('buttons.play')}
          </Button>
          <div className="title__icons">
            <LanguageControl />
            <SoundControl />
          </div>
        </div>
      </div>
      <p className="sr-only">{t('a11y.titleDemo')}</p>
    </div>
  );
}
