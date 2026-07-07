interface LegalTableRow {
  label: string;
  value: string;
}

interface LegalTableProps {
  headers: [string, string];
  rows: LegalTableRow[];
}

export default function LegalTable({ headers, rows }: LegalTableProps) {
  return (
    <table className="w-full border-collapse mb-3">
      <thead>
        <tr className="text-left border-b border-neutral-600">
          <th className="py-1 pr-4">{headers[0]}</th>
          <th className="py-1">{headers[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={row.label}
            className={i < rows.length - 1 ? 'border-b border-neutral-800' : ''}
          >
            <td className="py-1 pr-4">{row.label}</td>
            <td className="py-1">{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}