export default function SecurityLogsTableHeader() {
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        <th className="px-4 py-3 font-medium">When</th>
        <th className="px-4 py-3 font-medium">IP</th>
        <th className="px-4 py-3 font-medium">Method</th>
        <th className="px-4 py-3 font-medium">Path</th>
        <th className="px-4 py-3 font-medium">User</th>
        <th className="px-4 py-3 font-medium">User agent</th>
      </tr>
    </thead>
  );
}
