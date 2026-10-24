import { useEffect, useMemo, useRef, useState } from 'react';
import type { Area } from '../../types/models';
import { SearchIcon, ChevronDownIcon } from '../UI/Icons';
import { useI18n } from '../../i18n/useI18n';

interface NotebookSubjectPickerProps {
  areas: Area[];
  selectedAreaId: string | null;
  onSelect: (area: Area) => void;
  // true só quando o backend anotou usedInPeriod (periodo concreto
  // selecionado, não "todos os períodos") - nesse caso separamos as
  // cadeiras do período das restantes; senão mostramos tudo junto.
  groupByPeriod: boolean;
}

// Sem periodo concreto (todas as cadeiras juntas), so as primeiras ficam
// em chip; o resto vai para o menu "outras", com pesquisa.
const MAX_CHIPS_UNGROUPED = 8;

const FALLBACK_COLOR = '#8b5cf6';

function areaColor(area: Area): string {
  return area.colorHex && /^#[0-9a-f]{6}$/i.test(area.colorHex) ? area.colorHex : FALLBACK_COLOR;
}

// Chip de cadeira: ponto na cor da cadeira + nome. O ativo fica com o fundo
// e a borda na cor da propria cadeira.
function SubjectChip({
  area,
  isSelected,
  onSelect,
}: {
  area: Area;
  isSelected: boolean;
  onSelect: (area: Area) => void;
}) {
  const color = areaColor(area);
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      data-area-id={area.id}
      title={area.name}
      onClick={() => onSelect(area)}
      style={isSelected ? { borderColor: color, backgroundColor: `${color}26` } : undefined}
      className={`inline-flex max-w-[16rem] shrink-0 sm:max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 ${
        isSelected
          ? 'font-medium text-white'
          : 'border-neutral-800 bg-neutral-900/60 text-neutral-300 hover:border-neutral-600 hover:text-white'
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="truncate">{area.name}</span>
    </button>
  );
}

// As cadeiras do periodo em chips que passam para a linha seguinte (no
// telemovel deslizam na horizontal, sem barra visivel). As outras ficam num
// menu com pesquisa, para nao encherem o ecra num curso com 40 cadeiras.
export default function NotebookSubjectPicker({
  areas,
  selectedAreaId,
  onSelect,
  groupByPeriod,
}: NotebookSubjectPickerProps) {
  const { t } = useI18n();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const { chipAreas, menuAreas } = useMemo(() => {
    let chips: Area[];
    if (groupByPeriod) {
      chips = areas.filter((a) => a.usedInPeriod);
      // Periodo sem cadeiras usadas: mostra algumas em vez de nenhuma.
      if (chips.length === 0) chips = areas.slice(0, MAX_CHIPS_UNGROUPED);
    } else {
      chips = areas.length <= MAX_CHIPS_UNGROUPED + 2 ? areas : areas.slice(0, MAX_CHIPS_UNGROUPED);
    }
    // A cadeira aberta tem sempre o seu chip, mesmo vinda do menu.
    const selected = areas.find((a) => a.id === selectedAreaId);
    if (selected && !chips.includes(selected)) chips = [...chips, selected];
    const chipIds = new Set(chips.map((a) => a.id));
    return { chipAreas: chips, menuAreas: areas.filter((a) => !chipIds.has(a.id)) };
  }, [areas, groupByPeriod, selectedAreaId]);

  const filteredMenu = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return menuAreas;
    return menuAreas.filter((area) => area.name.toLowerCase().includes(normalized));
  }, [menuAreas, query]);

  const closeMenu = () => {
    setIsMenuOpen(false);
    setQuery('');
  };

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    searchRef.current?.focus();
    const close = () => {
      setIsMenuOpen(false);
      setQuery('');
    };
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) close();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isMenuOpen]);

  // No telemovel os chips deslizam numa so linha: traz a cadeira aberta
  // para a vista (no desktop passam para a linha seguinte e nada acontece).
  // So mexe na faixa, nunca no scroll da pagina.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !selectedAreaId || strip.scrollWidth <= strip.clientWidth) return;
    const chip = strip.querySelector<HTMLElement>(`[data-area-id="${CSS.escape(selectedAreaId)}"]`);
    if (!chip) return;
    const stripBox = strip.getBoundingClientRect();
    const chipBox = chip.getBoundingClientRect();
    if (chipBox.left < stripBox.left) strip.scrollLeft += chipBox.left - stripBox.left - 8;
    else if (chipBox.right > stripBox.right) strip.scrollLeft += chipBox.right - stripBox.right + 8;
  }, [selectedAreaId, chipAreas]);

  const otherLabel = t(menuAreas.length === 1 ? 'notebook.subjects.otherCountOne' : 'notebook.subjects.otherCount', {
    count: menuAreas.length,
  });

  const pick = (area: Area) => {
    onSelect(area);
    closeMenu();
  };

  return (
    <div ref={containerRef} className="relative flex items-start gap-2">
      <div
        ref={stripRef}
        role="group"
        aria-label={t('notebook.subjects.label')}
        className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
      >
        {chipAreas.map((area) => (
          <SubjectChip key={area.id} area={area} isSelected={area.id === selectedAreaId} onSelect={pick} />
        ))}
      </div>

      {menuAreas.length > 0 && (
        <div className="relative shrink-0 py-0.5">
          <button
            type="button"
            onClick={() => (isMenuOpen ? closeMenu() : setIsMenuOpen(true))}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            aria-label={otherLabel}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-dashed border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
          >
            {/* No telemovel so "+32": o texto inteiro tirava metade da linha aos chips. */}
            <span className="sm:hidden" aria-hidden="true">
              +{menuAreas.length}
            </span>
            <span className="hidden sm:inline">{otherLabel}</span>
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-[var(--duration-fast)] ease-smooth-out ${isMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isMenuOpen && (
            <div className="motion-dropdown origin-top-right absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl">
              <div className="relative border-b border-neutral-800 p-2">
                <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredMenu.length > 0) pick(filteredMenu[0]);
                  }}
                  placeholder={t('notebook.subjects.filter')}
                  aria-label={t('notebook.subjects.filter')}
                  className="w-full rounded-md border border-neutral-800 bg-neutral-950 py-1.5 pl-8 pr-2 text-sm text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
                />
              </div>
              {filteredMenu.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-neutral-500">
                  {t('notebook.subjects.noMatch', { query })}
                </p>
              ) : (
                <ul aria-label={t('notebook.subjects.other')} className="max-h-72 overflow-y-auto py-1">
                  {filteredMenu.map((area) => (
                    <li key={area.id}>
                      <button
                        type="button"
                        onClick={() => pick(area)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white focus-visible:bg-neutral-800 focus-visible:outline-none"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: areaColor(area) }}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1">{area.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
