interface ErrorStateProps {
  message: string;
}

export default function ErrorState({ message }: ErrorStateProps) {
  return (
    <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
      {message}
    </div>
  );
}
