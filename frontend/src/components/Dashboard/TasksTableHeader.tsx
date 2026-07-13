export default function TasksTableHeader() {
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
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
