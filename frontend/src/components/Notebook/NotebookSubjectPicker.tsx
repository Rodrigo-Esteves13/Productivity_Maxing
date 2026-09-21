import { useMemo, useState } from 'react';
import type { Area } from '../../types/models';
import { SearchIcon, ChevronDownIcon } from '../UI/Icons';

interface NotebookSubjectPickerProps {
  areas: Area[];
  selectedAreaId: string | null;
  onSelect: (area: Area) => void;
  // true só quando o backend anotou usedInPeriod (periodo concreto
  // selecionado, não "todos os períodos") - nesse caso agrupamos; senão
  // mostramos tudo junto, sem secções, porque a distinção não faz sentido.
  groupByPeriod: boolean;
}

function Chip({
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
      onClick={() => onSelect(area)}
      title={area.name}
      className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-left text-xs transition-colors ${
        isSelected
          ? 'border-violet-500 bg-violet-600/20 text-violet-200'
          : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-white'
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: area.colorHex }}
      />
      <span className="truncate">{area.name}</span>
    </button>
  );
}

// Grelha que envolve (wrap) em vez de uma coluna vertical única - o mesmo
// número de cadeiras ocupa uma fração da altura, e o max-h + overflow-y
// garante que NUNCA cresce sem fim, seja um semestre com 5 ou com 50
// cadeiras (a barra de scroll fica interna a este bloco, nunca empurra o
// resto da página para baixo). Nunca esconde uma cadeira por período -
// só agrupa "Este período" das restantes, que ficam recolhidas por
// default mas continuam pesquisáveis.
export default function NotebookSubjectPicker({
  areas,
  selectedAreaId,
  onSelect,
  groupByPeriod,
}: NotebookSubjectPickerProps) {
  const [query, setQuery] = useState('');
  const [showOthers, setShowOthers] = useState(!groupByPeriod);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return areas;
    return areas.filter((area) => area.name.toLowerCase().includes(normalized));
  }, [areas, query]);

  const periodAreas = groupByPeriod ? filtered.filter((a) => a.usedInPeriod) : filtered;
  const otherAreas = groupByPeriod ? filtered.filter((a) => !a.usedInPeriod) : [];
  // Pesquisar revela sempre os "outros" que fizerem match, mesmo
  // recolhidos - não faz sentido esconder um resultado de busca.
  const isSearching = query.trim().length > 0;
  const otherAreasVisible = showOthers || isSearching;

  return (
    <div className="space-y-2">
      {areas.length > 8 && (
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter subjects..."
            className="w-full rounded-md border border-neutral-800 bg-neutral-900 py-1.5 pl-8 pr-2 text-xs text-neutral-100 placeholder-neutral-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-xs text-neutral-500">No subjects match "{query}".</p>
      ) : !groupByPeriod ? (
        <div className="flex max-h-[60vh] flex-wrap content-start gap-1.5 overflow-y-auto pr-1">
          {filtered.map((area) => (
            <Chip key={area.id} area={area} isSelected={area.id === selectedAreaId} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {periodAreas.length > 0 && (
            <div className="flex flex-wrap content-start gap-1.5">
              {periodAreas.map((area) => (
                <Chip key={area.id} area={area} isSelected={area.id === selectedAreaId} onSelect={onSelect} />
              ))}
            </div>
          )}

          {otherAreas.length > 0 && (
            <div>
              {periodAreas.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowOthers((v) => !v)}
                  className="mb-1.5 flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-300"
                >
                  <ChevronDownIcon
                    className={`h-3.5 w-3.5 transition-transform ${otherAreasVisible ? '' : '-rotate-90'}`}
                  />
                  {otherAreasVisible ? 'Other subjects' : `${otherAreas.length} other subjects`}
                </button>
              )}
              {otherAreasVisible && (
                <div className="flex flex-wrap content-start gap-1.5">
                  {otherAreas.map((area) => (
                    <Chip key={area.id} area={area} isSelected={area.id === selectedAreaId} onSelect={onSelect} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
