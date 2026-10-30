import { useI18n } from '../../i18n/index';
import { useImages, imgUrl } from '../assets-context';
import { Btn } from '../Btn';

export function StepGuide({ active, onSkip }: { active?: number; onSkip?: () => void }) {
  const { t } = useI18n();
  const images = useImages();
  const steps = [
    { icon: 'panel_bubble' as const, text: t('help.order') },
    { icon: 'egg' as const, text: t('help.build') },
    { icon: 'bowl' as const, text: t('help.serve', { serve: t('serve') }) },
  ];
  return (
    <div className={active === undefined ? 'step-guide' : 'step-guide coach'} aria-label={t('help.title')}>
      <ol aria-live={active === undefined ? 'off' : 'polite'} aria-atomic="true">
        {steps.map((step, i) => (active === undefined || active === i) && (
          <li key={i} data-step={i}>
            <span className="step-number" aria-hidden="true">{i + 1}</span>
            <span className="step-art" aria-hidden="true">
              {imgUrl(images, step.icon) ? <img draggable={false} src={imgUrl(images, step.icon)} alt="" /> : <span className="img-fallback" />}
              {i === 0 && imgUrl(images, 'egg') && <img draggable={false} className="guide-order-icon" src={imgUrl(images, 'egg')} alt="" />}
            </span>
            <span>{step.text}</span>
          </li>
        ))}
      </ol>
      {onSkip && <Btn className="coach-skip" onClick={onSkip}>{t('help.skip')}</Btn>}
    </div>
  );
}
