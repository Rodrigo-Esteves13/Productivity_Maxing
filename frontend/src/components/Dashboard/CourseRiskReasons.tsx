import type { CourseRisk } from '../../types/models';
import { formatReasonParams } from '../../lib/courseRisk';
import type { RiskTranslate } from '../../lib/courseRisk';

interface CourseRiskReasonsProps {
  reasons: CourseRisk['reasons'];
  t: RiskTranslate;
  lang: string;
}

// Um motivo por codigo, traduzido com os params que o motor envia.
export default function CourseRiskReasons({ reasons, t, lang }: CourseRiskReasonsProps) {
  if (reasons.length === 0) return null;
  return (
    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-neutral-400">
      {reasons.map((reason, index) => (
        <li key={`${reason.code}-${index}`} data-reason={reason.code}>
          {t(`courseRisk.reason.${reason.code}`, formatReasonParams(reason.params, lang))}
        </li>
      ))}
    </ul>
  );
}
