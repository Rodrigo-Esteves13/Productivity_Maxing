interface TaskCardProps {
  title: string;
  description: string;
  status: 'pending' | 'completed' | 'in-progress';
}

export default function TaskCard({ title, description, status }: TaskCardProps) {

    const statusColors = {
    'pending': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'in-progress': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'completed': 'bg-green-500/10 text-green-500 border-green-500/20'
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 hover:border-neutral-700 transition-colors">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[status]}`}>
          {status.toUpperCase()}
        </span>
      </div>
      <p className="mt-2 text-sm text-neutral-400">{description}</p>
    </div>
  );
}