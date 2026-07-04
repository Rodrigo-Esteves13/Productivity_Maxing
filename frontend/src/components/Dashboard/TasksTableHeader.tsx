export default function TasksTableHeader() {
  return (
    <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50 border-b border-neutral-800">
      <tr>
        <th className="px-4 py-3 font-medium">Data</th>
        <th className="px-4 py-3 font-medium">Área</th>
        <th className="px-4 py-3 font-medium">Título / Tópicos</th>
        <th className="px-4 py-3 font-medium">Tipo</th>
        <th className="px-4 py-3 font-medium">Peso</th>
        <th className="px-4 py-3 font-medium">Dificuldade</th>
        <th className="px-4 py-3 font-medium text-center">Status</th>
        <th className="px-4 py-3 font-medium text-center">Nota Alvo</th>
        <th className="px-4 py-3 font-medium text-center">Nota Real</th>
      </tr>
    </thead>
  );
}
