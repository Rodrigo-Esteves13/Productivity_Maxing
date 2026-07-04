interface TechBadgeProps {
  label: string;
  dimmed?: boolean;
}

// Um "selo" pequenino para mostrar a stack usada no projeto
export default function TechBadge({ label, dimmed = false }: TechBadgeProps) {
  return (
    <span
      className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
        dimmed
          ? 'border-neutral-800 text-neutral-500 border-dashed'
          : 'border-neutral-700 text-neutral-300 bg-neutral-900 hover:border-violet-500/50 hover:text-violet-300'
      }`}
    >
      {label}
    </span>
  );
}
