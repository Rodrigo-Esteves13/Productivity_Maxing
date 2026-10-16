import type { Area } from '../../types/models';

// Etiqueta curta: Official / Personal / Under review / Not approved.
export default function AreaStatusBadge({ area }: { area: Area }) {
  let label = 'Official';
  let cls = 'border-neutral-700 text-neutral-400';
  if (!area.isOfficial) {
    if (area.proposalStatus === 'PENDING') {
      label = 'Under review';
      cls = 'border-amber-500/40 text-amber-400';
    } else if (area.proposalStatus === 'REJECTED') {
      label = 'Not approved';
      cls = 'border-red-500/40 text-red-400';
    } else {
      label = 'Personal';
      cls = 'border-violet-500/40 text-violet-300';
    }
  }
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${cls}`}>
      {label}
    </span>
  );
}
