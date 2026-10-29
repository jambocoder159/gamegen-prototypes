// Shared play-field: the stall (customers + chef), the bowl and the topping/serve
// controls. Rendered both by the interactive GameScreen and, non-interactively, by
// the title-screen demo. All geometry is driven by CSS `mode-*` classes.

import { useI18n } from '../i18n/index';
import { PlateButton } from './controls';
import { Chef } from './components/Chef';
import { Customer } from './components/Customer';
import { Bowl } from './components/Bowl';
import { ToppingButton } from './components/ToppingButton';
import { TOPPINGS, type GameState, type Topping } from '../game/logic';
import type { LayoutMode } from '../platform/layout';

const noop = () => {};

export function PlayField({
  state,
  interactive,
  reducedMotion,
  chefFrame,
  mode,
  onToggle = noop,
  onClear = noop,
  onServe = noop,
  onSelect = noop,
}: {
  state: GameState;
  interactive: boolean;
  reducedMotion: boolean;
  chefFrame: number;
  mode: LayoutMode;
  onToggle?: (t: Topping) => void;
  onClear?: () => void;
  onServe?: () => void;
  onSelect?: (id: number) => void;
}) {
  const { t } = useI18n();
  const customers = [...state.customers].sort((a, b) => a.seat - b.seat);
  const hasTarget = customers.some((c) => c.phase === 'ordering');

  return (
    <div className={`play-field mode-${mode}`}>
      <div className="toppings" role="group" aria-label={t('serve')}>
        {TOPPINGS.map((tp, i) => (
          <ToppingButton
            key={tp}
            topping={tp}
            index={i}
            inBowl={state.bowl.includes(tp)}
            interactive={interactive}
            onToggle={onToggle}
          />
        ))}
      </div>

      <div className="center">
        <div className="stall">
          <div className="chef-wrap" aria-hidden="true">
            <Chef frame={reducedMotion ? 1 : chefFrame} />
          </div>
          <div className="customers">
            {customers.map((c) => (
              <Customer
                key={c.id}
                c={c}
                selected={c.id === state.selectedId}
                interactive={interactive}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>

        <div className="bowl-wrap">
          <Bowl bowl={state.bowl} onClear={onClear} reducedMotion={reducedMotion} interactive={interactive} />
        </div>
      </div>

      <div className="actions">
        <PlateButton
          className="serve-btn"
          onClick={onServe}
          disabled={!interactive || !hasTarget}
          silent={!interactive}
          tabIndex={interactive ? 0 : -1}
        >
          {t('serve')}
        </PlateButton>
      </div>
    </div>
  );
}
