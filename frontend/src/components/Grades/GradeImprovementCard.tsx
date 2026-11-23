import { useMemo } from 'react';
import { gradeImprovements, IMPROVEMENT_DELTAS } from '../../lib/gradeImprovement';
import { scaleMax } from '../../lib/gradeScale';
import { useI18n } from '../../i18n/useI18n';
import { formatNumber } from '../../lib/ratings';
import type { PeriodReportCard } from '../../types/models';

const GAIN_DECIMALS = 2;

// Melhoria de nota: quanto a media do periodo sobe se uma cadeira aprovada
// subir +1 ou +2. So simula; se a melhoria e permitida (uma vez por UC, nunca
// em epoca especial) depende do regulamento da tua escola.
export default function GradeImprovementCard({ card }: { card: PeriodReportCard }) {
  const { t, lang } = useI18n();
  const rows = useMemo(() => gradeImprovements(card.areas, scaleMax(card.gradeScale)), [card]);
  if (rows.length === 0) return null;

  return (
    <section className="print-hide mt-4 rounded-xl border border-neutral-800 bg-neutral-900/40 p-5">
      <h2 className="text-base font-semibold text-white">{t('reportCard.improve.title')}</h2>
      <p className="mb-3 text-sm text-neutral-400">{t('reportCard.improve.intro')}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-neutral-400">
              <th className="py-2 pr-3 font-medium">{t('reportCard.course')}</th>
              <th className="py-2 pr-3 text-right font-medium">{t('reportCard.grade')}</th>
              {IMPROVEMENT_DELTAS.map((delta) => (
                <th key={delta} className="py-2 pr-3 text-right font-medium">
                  {t('reportCard.improve.raise', { delta })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.areaId} className="border-b border-neutral-800/60">
                <td className="py-2 pr-3 text-neutral-200">{row.areaName}</td>
                <td className="py-2 pr-3 text-right text-neutral-300">{formatNumber(row.grade, lang, GAIN_DECIMALS)}</td>
                {row.gains.map((gain, index) => (
                  <td key={IMPROVEMENT_DELTAS[index]} className="py-2 pr-3 text-right font-medium text-violet-300">
                    +{formatNumber(gain, lang, GAIN_DECIMALS)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-500">{t('reportCard.improve.caveat')}</p>
    </section>
  );
}
