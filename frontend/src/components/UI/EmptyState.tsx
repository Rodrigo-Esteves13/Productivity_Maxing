interface EmptyStateProps {
  message: string;
}

export default function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className="p-8 text-center bg-neutral-900/50 border border-neutral-800 rounded-xl">
      <p className="text-neutral-400">{message}</p>
    </div>
  );
}
