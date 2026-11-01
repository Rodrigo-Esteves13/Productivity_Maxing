import type { MouseEvent } from 'react';
import { PencilIcon, TrashIcon, UserIcon } from '../UI/Icons';
import AreaStatusBadge from './AreaStatusBadge';
import AreaOverviewBadges from './AreaOverviewBadges';
import ProgressBar from '../UI/ProgressBar';
import type { Area } from '../../types/models';
import type { AreaOverviewItem } from '../../lib/areaOverview';
import { formatNumber } from '../../lib/ratings';
import { useI18n } from '../../i18n/useI18n';
import IconButton from '../UI/IconButton';

interface AreaCardProps {
  area: Area;
  canManage: boolean;
  onSelect: (area: Area) => void;
  onEdit: (area: Area) => void;
  onDelete: (id: string) => void;
  // Só para oficiais: liga/desliga para o próprio utilizador.
  onToggleHidden?: (area: Area) => void;
  // Modo de selecao: mostra a checkbox. Abrir os detalhes continua a funcionar.
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (area: Area) => void;
  // Resumo opcional (tarefas, risco, docente). Sem ele o cartao fica so com o basico.
  overview?: AreaOverviewItem;
  overviewLoading?: boolean;
  overviewFailed?: boolean;
  // Maximo da escala de notas do programa ativo; null = sem escala unica (vista de todos).
  gradeMax?: number | null;
}

const CREDITS_FRACTION_DIGITS = 1;
const AVERAGE_FRACTION_DIGITS = 1;
const PERCENT = 100;

// Os controlos dentro do cartao nao abrem os detalhes por baixo.
const stop = (e: MouseEvent) => e.stopPropagation();

export default function AreaCard({
  area,
  canManage,
  onSelect,
  onEdit,
  onDelete,
  onToggleHidden,
  selectMode = false,
  selected = false,
  onToggleSelect,
  overview,
  overviewLoading = false,
  overviewFailed = false,
  gradeMax = null,
}: AreaCardProps) {
  const { t, lang } = useI18n();
  const canSelect = selectMode && Boolean(onToggleSelect);
  const teacherName = overview?.teacherName ?? null;
  const average = overview?.currentAverage ?? null;
  const showAverage = average !== null && gradeMax !== null && gradeMax > 0;

  // Com o rato o cartao todo responde: no modo de selecao marca-o, fora dele
  // abre os detalhes. Para o teclado continua a haver o botao do nome.
  const handleCardClick = () => {
    if (canSelect) onToggleSelect?.(area);
    else onSelect(area);
  };

  return (
    <div
      onClick={handleCardClick}
      className={`group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-neutral-900/50 transition-[border-color] duration-[var(--duration-quick)] ease-smooth-out in-data-[theme=light]:shadow-sm ${
        selectMode && selected ? 'border-violet-500' : 'border-neutral-800 hover:border-neutral-700'
      } ${area.isHidden ? 'border-dashed' : ''}`}
    >
      {/* Cor da cadeira como barra a esquerda (vem dos dados, por isso inline).
          Desligada: so a barra esmorece, o texto continua legivel. */}
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 transition-opacity duration-[var(--duration-quick)] ease-smooth-out ${
          area.isHidden ? 'opacity-40' : ''
        }`}
        style={{ backgroundColor: area.colorHex }}
      />

      <div className="flex h-full flex-col gap-3 py-4 pl-5 pr-3">
        <div className="flex items-start gap-2">
          {canSelect && (
            // Alvo de toque de 40px (-m-3 p-3) para funcionar bem no telemovel.
            <label onClick={stop} className="-my-3 -ml-3 -mr-1 flex shrink-0 cursor-pointer items-center p-3">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggleSelect?.(area)}
                aria-label={t('areas.select.cardLabel', { name: area.name })}
                className="h-4 w-4 cursor-pointer accent-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
              />
            </label>
          )}
          <div className="min-w-0 flex-1">
            {/* button e nao div com onClick: com o teclado os detalhes da area
                nao abriam de todo. */}
            <h3 className="line-clamp-2 text-base font-medium leading-snug text-white">
              <button
                type="button"
                onClick={(e) => {
                  stop(e);
                  onSelect(area);
                }}
                title={t('ui.viewDetails')}
                className="rounded text-left transition-colors duration-[var(--duration-quick)] hover:text-violet-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
              >
                {area.name}
              </button>
            </h3>
            {teacherName && (
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-neutral-500">
                <UserIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span className="sr-only">{t('teacher.label')}: </span>
                <span className="truncate">{teacherName}</span>
              </p>
            )}
          </div>

          {area.isOfficial && onToggleHidden && (
            <button
              type="button"
              role="switch"
              aria-checked={!area.isHidden}
              aria-label={`${area.name} ${area.isHidden ? 'off' : 'on'}`}
              title={area.isHidden ? t('ui.offHiddenFromYourLists') : t('ui.onClickToHideFrom')}
              onClick={(e) => {
                stop(e);
                onToggleHidden(area);
              }}
              // before: alarga o alvo para 40px de altura sem mudar o desenho.
              className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-[var(--duration-fast)] ease-smooth-out before:absolute before:-inset-x-1.5 before:-inset-y-2.5 before:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
                area.isHidden ? 'bg-neutral-600 ring-1 ring-inset ring-neutral-500' : 'bg-violet-600'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-[var(--duration-fast)] ease-smooth-out ${
                  area.isHidden ? 'translate-x-0' : 'translate-x-4'
                }`}
              />
            </button>
          )}
        </div>

        <AreaOverviewBadges item={overview} isLoading={overviewLoading} failed={overviewFailed} />

        {showAverage && (
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-2 text-xs text-neutral-500">
              <span>{t('courseRisk.field.average')}</span>
              <span className="tabular-nums text-neutral-300">
                {formatNumber(average, lang, AVERAGE_FRACTION_DIGITS)}
                <span className="text-neutral-500"> / {formatNumber(gradeMax, lang, 0)}</span>
              </span>
            </div>
            <ProgressBar percent={(average / gradeMax) * PERCENT} thickness="sm" />
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <AreaStatusBadge area={area} />
            {area.credits !== null && area.credits > 0 && (
              <span className="shrink-0 rounded-full border border-neutral-700 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide tabular-nums text-neutral-400">
                {t('areas.card.credits', { count: formatNumber(area.credits, lang, CREDITS_FRACTION_DIGITS) })}
              </span>
            )}
          </div>

          {canManage && (
            // Com rato: aparecem ao passar ou ao focar. Em ecras de toque ficam sempre visiveis.
            <div
              onClick={stop}
              className="-my-1.5 -mr-1 flex shrink-0 items-center transition-opacity duration-[var(--duration-quick)] ease-smooth-out pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100"
            >
              <IconButton label={t('ui.editArea')} onClick={() => onEdit(area)} className="h-10 w-10">
                <PencilIcon />
              </IconButton>
              <IconButton label={t('ui.deleteArea')} tone="danger" onClick={() => onDelete(area.id)} className="h-10 w-10">
                <TrashIcon />
              </IconButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
