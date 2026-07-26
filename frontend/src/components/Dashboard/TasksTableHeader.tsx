interface TasksTableHeaderProps {
  allSelected?: boolean;
  onToggleAll?: () => void;
}

export default function TasksTableHeader({ allSelected, onToggleAll }: TasksTableHeaderProps) {
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        {onToggleAll && (
          <th className="px-4 py-3 font-medium print-hide">
            <input
              type="checkbox"
              checked={!!allSelected}
              onChange={onToggleAll}
              className="accent-violet-500"
              aria-label="Select all tasks"
            />
          </th>
        )}
        <th className="px-4 py-3 font-medium">Date / Due</th>
        <th className="px-4 py-3 font-medium">Area</th>
        <th className="px-4 py-3 font-medium">Title / Topics</th>
        <th className="px-4 py-3 font-medium">Type / Weight</th>
        <th className="px-4 py-3 font-medium">Difficulty</th>
        <th className="px-4 py-3 font-medium text-center">Status</th>
        <th className="px-4 py-3 font-medium text-center">Target / Real</th>
        <th className="px-4 py-3 font-medium text-center">Calendar</th>
      </tr>
    </thead>
  );
}
