import { escapeCsvField } from './taskExportFormats';
import type { PeriodReportCard } from '../types/models';

type Translate = (key: string) => string;

// Valores em bruto (ponto decimal): um CSV com virgula decimal partia as colunas.
function cell(value: number | null): string {
  return value === null ? '' : String(value);
}

// Boletim de um periodo em CSV: cabecalho traduzido, uma linha por cadeira e
// uma linha final com a media e os creditos do periodo.
export function reportCardToCsv(card: PeriodReportCard, t: Translate): string {
  const header = [
    t('reportCard.course'),
    t('reportCard.credits'),
    t('reportCard.grade'),
    t('reportCard.result'),
  ];
  const lines = [header.map(escapeCsvField).join(',')];
  for (const row of card.areas) {
    lines.push(
      [
        row.areaName,
        cell(row.credits),
        cell(row.average),
        t(row.passed ? 'reportCard.passed' : 'reportCard.notPassed'),
      ]
        .map(escapeCsvField)
        .join(','),
    );
  }
  lines.push(
    [t('reportCard.average'), String(card.earnedCredits), cell(card.average), ''].map(escapeCsvField).join(','),
  );
  return lines.join('\n') + '\n';
}

export function reportCardFileName(card: Pick<PeriodReportCard, 'periodName'>): string {
  const slug = card.periodName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `pmaxing_report_card_${slug || 'period'}.csv`;
}
