interface FormErrorProps {
  message: string;
}

export default function FormError({ message }: FormErrorProps) {
  return (
    // role="alert" torna isto uma live region assertiva - um leitor de ecrã
    // anuncia a mensagem no momento em que ela aparece, mesmo que o foco
    // continue no campo do formulário. Sem isto, um erro de login só é
    // percetível visualmente.
    <div
      role="alert"
      className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm"
    >
      {message}
    </div>
  );
}
