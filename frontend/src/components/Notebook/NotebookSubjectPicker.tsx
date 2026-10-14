import { useMemo, useState } from 'react';
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

// Separador de cadeira: ponto na cor da cadeira + nome; o ativo ganha um
// traco por baixo na cor da propria cadeira (como os separadores de um
// caderno de argolas).
function SubjectTab({
  area,
  isSelected,
  onSelect,
}: {
  area: Area;
  isSelected: boolean;
  onSelect: (area: Area) => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      title={area.name}
      onClick={() => onSelect(area)}
      style={isSelected ? { borderBottomColor: area.colorHex } : undefined}
      className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400 ${
        isSelected ? 'font-medium text-white' : 'border-transparent text-neutral-400 hover:text-neutral-100'
      }`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: area.colorHex }} />
      <span className="max-w-[12rem] truncate">{area.name}</span>
    </button>
  );
}

// Uma linha de separadores com scroll horizontal (nunca cresce em altura,
// seja um semestre com 5 ou com 50 cadeiras). As cadeiras que não são do
// período ficam recolhidas atrás de um botão mas continuam pesquisáveis.
export default function NotebookSubjectPicker({
  areas,
  selectedAreaId,
  onSelect,
  groupByPeriod,
}: NotebookSubjectPickerProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [showOthers, setShowOthers] = useState(!groupByPeriod);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return areas;
    return areas.filter((area) => area.name.toLowerCase().includes(normalized));
  }, [areas, query]);

  const periodAreas = groupByPeriod ? filtered.filter((a) => a.usedInPeriod) : filtered;
  const otherAreas = groupByPeriod ? filtered.filter((a) => !a.usedInPeriod) : [];
  // Pesquisar revela sempre os "outros" que fizerem match, mesmo recolhidos.
  const isSearching = query.trim().length > 0;
  const otherAreasVisible = showOthers || isSearching;

  return (
    <div className="space-y-2">
      {areas.length > 8 && (
        <div className="relative max-w-xs">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('notebook.subjects.filter')}
            aria-label={t('notebook.subjects.filter')}
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-2 text-xs text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-xs text-neutral-500">{t('notebook.subjects.noMatch', { query })}</p>
      ) : (
        <>
          {periodAreas.length > 0 && (
            <div role="tablist" className="flex overflow-x-auto border-b border-neutral-800">
              {periodAreas.map((area) => (
                <SubjectTab key={area.id} area={area} isSelected={area.id === selectedAreaId} onSelect={onSelect} />
              ))}
            </div>
          )}

          {otherAreas.length > 0 && (
            <div>
              {periodAreas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOthers((v) => !v)}
                  aria-expanded={otherAreasVisible}
                  className="mb-1 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300"
                >
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 transition-transform ${otherAreasVisible ? '' : '-rotate-90'}`}
                  />
                  {otherAreasVisible
                    ? t('notebook.subjects.other')
                    : t('notebook.subjects.otherCount', { count: otherAreas.length })}
                </button>
              )}
              {otherAreasVisible && (
                <div role="tablist" className="flex max-h-40 flex-wrap overflow-y-auto">
                  {otherAreas.map((area) => (
                    <SubjectTab key={area.id} area={area} isSelected={area.id === selectedAreaId} onSelect={onSelect} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
