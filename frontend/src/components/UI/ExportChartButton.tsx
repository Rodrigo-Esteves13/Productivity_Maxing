import { useEffect, useRef, useState, type RefObject } from 'react';
import IconButton from './IconButton';
import { ImageIcon } from './Icons';
import { COPY_FEEDBACK_MS } from '../../lib/constants';
import { useI18n } from '../../i18n/useI18n';
import { exportSvgAsPng } from '../../utils/exportSvgAsPng';

// Recharts draws its chart as one <svg class="recharts-surface">.
const CHART_SVG_SELECTOR = 'svg.recharts-surface';

interface ExportChartButtonProps {
  /** Element that contains the chart's SVG (the SVG itself also works). */
  containerRef: RefObject<HTMLElement | SVGSVGElement | null>;
  /** Base of the downloaded filename; slugified and dated by the exporter. */
  filenameSlug: string;
  /** True while values are hidden (privacy mode): nothing may be exported. */
  disabled?: boolean;
  className?: string;
}

type ExportStatus = 'idle' | 'busy' | 'failed';

function findSvg(root: HTMLElement | SVGSVGElement | null): SVGSVGElement | null {
  if (!root) return null;
  if (root instanceof SVGSVGElement) return root;
  return root.querySelector<SVGSVGElement>(CHART_SVG_SELECTOR) ?? root.querySelector('svg');
}

export default function ExportChartButton({ containerRef, filenameSlug, disabled = false, className = '' }: ExportChartButtonProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<ExportStatus>('idle');
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleClick = async () => {
    const svg = findSvg(containerRef.current);
    if (!svg || disabled || status === 'busy') return;
    setStatus('busy');
    try {
      await exportSvgAsPng(svg, filenameSlug);
      setStatus('idle');
    } catch {
      setStatus('failed');
      resetTimer.current = setTimeout(() => setStatus('idle'), COPY_FEEDBACK_MS);
    }
  };

  const label = disabled
    ? t('chartExport.disabledPrivacy')
    : status === 'failed'
      ? t('chartExport.failed')
      : t('chartExport.label');

  return (
    <IconButton
      label={label}
      onClick={handleClick}
      disabled={disabled || status === 'busy'}
      aria-busy={status === 'busy'}
      className={`min-h-8 min-w-8 p-1.5 ${status === 'failed' ? 'text-red-400' : ''} ${className}`}
    >
      <ImageIcon className="h-4 w-4" aria-hidden="true" />
    </IconButton>
  );
}
