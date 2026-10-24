interface ErrorStateProps {
  message: string;
}

export default function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="p-4 bg-red-950/40 border border-red-900/50 rounded-lg text-red-300">
      {message}
    </div>
  );
}
