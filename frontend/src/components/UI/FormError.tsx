interface FormErrorProps {
  message: string;
}

export default function FormError({ message }: FormErrorProps) {
  return (
    <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
      {message}
    </div>
  );
}
