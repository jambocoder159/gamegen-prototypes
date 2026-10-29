import { useImages, imgUrl } from '../assets-context';
import { useI18n } from '../../i18n/index';
import { Btn } from '../Btn';
import { PANEL_BUBBLE, PANEL_BAR } from '../../config/layout';
import { expressionOf, type Customer as CustomerT } from '../../game/logic';
import type { ImageKey } from '../../config/assets';

const HEIGHT_FACTOR: Record<string, number> = { cat: 1.0, bear: 1.04, fox: 1.02, rabbit: 1.08 };

function OrderBubble({ order }: { order: CustomerT['order'] }) {
  const images = useImages();
  const bubbleUrl = imgUrl(images, 'panel_bubble');
  const c = PANEL_BUBBLE.content;
  return (
    <div className="bubble" style={{ aspectRatio: String(PANEL_BUBBLE.aspect) }}>
      {bubbleUrl ? (
        <img className="bubble-img" src={bubbleUrl} alt="" aria-hidden="true" draggable={false} />
      ) : (
        <span className="img-fallback bubble-fb" aria-hidden="true" />
      )}
      <div
        className="bubble-content"
        aria-hidden="true"
        style={{
          left: `${c.left * 100}%`,
          right: `${(1 - c.right) * 100}%`,
          top: `${c.top * 100}%`,
          bottom: `${(1 - c.bottom) * 100}%`,
        }}
      >
        {order.map((tpg) => {
          const url = imgUrl(images, tpg as ImageKey);
          return (
            <span className="bubble-item" key={tpg}>
              {url ? <img src={url} alt="" draggable={false} /> : <span className="img-fallback" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PatienceBar({ ratio }: { ratio: number }) {
  const images = useImages();
  const barUrl = imgUrl(images, 'panel_bar');
  const f = PANEL_BAR.fill;
  const clamped = Math.max(0, Math.min(1, ratio));
  return (
    <div className="pbar" style={{ aspectRatio: String(PANEL_BAR.aspect) }} aria-hidden="true">
      {barUrl ? (
        <img className="pbar-frame" src={barUrl} alt="" draggable={false} />
      ) : (
        <span className="img-fallback pbar-fb" />
      )}
      <div
        className="pbar-channel"
        style={{
          left: `${f.left * 100}%`,
          right: `${(1 - f.right) * 100}%`,
          top: `${f.top * 100}%`,
          bottom: `${(1 - f.bottom) * 100}%`,
        }}
      >
        <div className="pbar-fill" style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}

export function Customer({
  c,
  selected,
  interactive,
  onSelect,
}: {
  c: CustomerT;
  selected: boolean;
  interactive: boolean;
  onSelect: (id: number) => void;
}) {
  const images = useImages();
  const { t } = useI18n();
  const expr = expressionOf(c);
  const key = `${c.animal}_${expr}` as ImageKey;
  const url = imgUrl(images, key);
  const factor = HEIGHT_FACTOR[c.animal] ?? 1;
  const list = c.order.map((x) => t(`toppings.${x}`)).join(', ');

  return (
    <div className={`customer seat-${c.seat}${selected ? ' selected' : ''} phase-${c.phase}`}>
      <Btn
        className="customer-btn"
        onClick={() => onSelect(c.id)}
        disabled={!interactive || c.phase !== 'ordering'}
        silent={!interactive}
        aria-label={`${t('aria.selectCustomer')}. ${t('aria.order', { list })}`}
        aria-pressed={selected}
        tabIndex={interactive && c.phase === 'ordering' ? 0 : -1}
      >
        {selected ? <span className="sel-caret" aria-hidden="true" /> : null}
        {c.phase === 'ordering' ? <OrderBubble order={c.order} /> : null}
        {c.phase === 'ordering' ? <PatienceBar ratio={c.patience / c.patienceMax} /> : null}
        <span className="customer-img-wrap" style={{ height: `calc(var(--cust-h) * ${factor})` }}>
          {url ? (
            <img className="customer-img" src={url} alt="" draggable={false} />
          ) : (
            <span className="img-fallback customer-fb" />
          )}
        </span>
      </Btn>
    </div>
  );
}
