type ProgressBarThickness = 'sm' | 'md';

interface ProgressBarProps {
  // 0 a 100. Valores fora do intervalo ou NaN ficam presos aos limites.
  percent: number;
  // Classe de fundo da parte preenchida (ex: 'bg-amber-500').
  fillClassName?: string;
  // Cor vinda de dados (ex: cor de uma area); ganha sobre fillClassName.
  fillColor?: string;
  thickness?: ProgressBarThickness;
  // Sem label a barra e decorativa (o texto ao lado ja diz o valor).
  label?: string;
  className?: string;
}

const THICKNESS_CLASS: Record<ProgressBarThickness, string> = {
  sm: 'h-1.5',
  md: 'h-2',
};

const DEFAULT_FILL_CLASS = 'bg-violet-500';

function clampPercent(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

// Barra de progresso unica da app. Antes cada cartao repetia o mesmo
// div com altura, cantos e overflow, e so alguns tinham role="progressbar".
export default function ProgressBar({
  percent,
  fillClassName = DEFAULT_FILL_CLASS,
  fillColor,
  thickness = 'sm',
  label,
  className = '',
}: ProgressBarProps) {
  const value = clampPercent(percent);
  const accessibility = label
    ? { role: 'progressbar', 'aria-valuenow': Math.round(value), 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': label }
    : { 'aria-hidden': true };

  return (
    <div
      className={`${THICKNESS_CLASS[thickness]} rounded-full bg-neutral-800 overflow-hidden ${className}`}
      {...accessibility}
    >
      <div
        className={`h-full ${fillClassName}`}
        style={{ width: `${value}%`, ...(fillColor && { backgroundColor: fillColor }) }}
      />
    </div>
  );
}
