import type { CourseRisk, RiskLevel } from '../../types/models';
import ColorDot from '../UI/ColorDot';
import ProgressBar from '../UI/ProgressBar';
import { formatReasonParams } from '../../lib/courseRisk';

export type RiskTranslate = (key: string, params?: Record<string, string | number>) => string;

// Cor do selo e da barra por nivel (tabela em vez de if/else).
// Sem verde: o nivel baixo fica neutro.
const LEVEL_STYLE: Record<RiskLevel, { badge: string; fill: string }> = {
  low: { badge: 'border-neutral-700 bg-neutral-800/60 text-neutral-300', fill: 'bg-neutral-500' },
  medium: { badge: 'border-violet-700 bg-violet-900/30 text-violet-200', fill: 'bg-violet-500' },
  high: { badge: 'border-red-800 bg-red-900/20 text-red-300', fill: 'bg-red-500/80' },
  extreme: { badge: 'border-red-700 bg-red-900/30 text-red-200', fill: 'bg-red-600' },
};

interface CourseRiskListProps {
  risks: CourseRisk[];
  t: RiskTranslate;
  // Idioma ativo, para o separador decimal dos numeros das razoes.
  lang: string;
}

// Lista apresentacional: a ordem e a do backend (score desc). Um motivo por
// codigo, traduzido com os params que o motor envia.
export default function CourseRiskList({ risks, t, lang }: CourseRiskListProps) {
  return (
    <ul className="space-y-4">
      {risks.map((risk) => {
        const style = LEVEL_STYLE[risk.level];
        return (
          <li key={risk.areaId} className="text-sm" data-testid="course-risk-row">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-neutral-200">
                <ColorDot size="xs" color={risk.colorHex} />
                <span className="truncate">{risk.areaName}</span>
              </span>
              <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style.badge}`}>
                {t(`courseRisk.level.${risk.level}`)}
              </span>
            </div>
            <ProgressBar
              percent={risk.score}
              fillClassName={style.fill}
              label={t('courseRisk.scoreLabel', { score: Math.round(risk.score) })}
            />
            <p className="mt-1 text-xs text-neutral-500">{t(`courseRisk.track.${risk.track}`)}</p>
            {risk.reasons.length > 0 && (
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-neutral-400">
                {risk.reasons.map((reason, index) => (
                  <li key={`${reason.code}-${index}`} data-reason={reason.code}>
                    {t(`courseRisk.reason.${reason.code}`, formatReasonParams(reason.params, lang))}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
