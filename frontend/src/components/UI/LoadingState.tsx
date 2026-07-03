interface LoadingStateProps {
  message?: string;
  className?: string;
}

export default function LoadingState({ message = 'A carregar...', className = 'py-10' }: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <p className="text-neutral-400 animate-pulse">{message}</p>
    </div>
  );
}
