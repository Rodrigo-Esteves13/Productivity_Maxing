export default function UsersTableHeader() {
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        <th className="px-4 py-3 font-medium">User</th>
        <th className="px-4 py-3 font-medium">Email</th>
        <th className="px-4 py-3 font-medium text-center">Role</th>
        <th className="px-4 py-3 font-medium">Joined</th>
        <th className="px-4 py-3 font-medium text-right">Actions</th>
      </tr>
    </thead>
  );
}
