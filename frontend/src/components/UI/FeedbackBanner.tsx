export interface Feedback {
  type: 'success' | 'error';
  message: string;
}

const TONE_CLASS: Record<Feedback['type'], string> = {
  success: 'border-violet-800 bg-violet-950/50 text-violet-300',
  error: 'border-red-500 bg-red-900/50 text-red-200',
};

interface FeedbackBannerProps {
  feedback: Feedback | null;
  className?: string;
}

// Mensagem curta de sucesso/erro no topo de uma pagina. Erros anunciam-se
// de imediato (role=alert), sucessos de forma discreta (role=status).
export default function FeedbackBanner({ feedback, className = '' }: FeedbackBannerProps) {
  if (!feedback) return null;
  return (
    <div
      role={feedback.type === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border p-3 text-sm ${TONE_CLASS[feedback.type]} ${className}`}
    >
      {feedback.message}
    </div>
  );
}
