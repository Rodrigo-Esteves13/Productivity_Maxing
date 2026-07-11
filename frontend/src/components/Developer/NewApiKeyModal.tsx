import { useState } from 'react';

interface NewApiKeyModalProps {
  apiKey: string;
  onClose: () => void;
}

// Mostra a raw key exatamente uma vez, logo a seguir a criá-la. O backend
// só guarda o hash - fechar este modal (ou dar refresh à página) perde a
// key para sempre, por isso o aviso é bem explícito e o fecho é sempre uma
// ação consciente do user (sem clique-fora nem Escape a fechar por acidente).
export default function NewApiKeyModal({ apiKey, onClose }: NewApiKeyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-neutral-800">
          <h2 className="text-lg font-bold text-white">Your new API key</h2>
        </div>

        <div className="p-5">
          <p className="text-sm text-amber-400 mb-4">
            Copy it now. For security reasons, it won't be shown again, if you lose it,
            you'll need to generate a new one.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-sm text-violet-300 font-mono break-all">
              {apiKey}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 px-3 py-2.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-sm font-medium text-neutral-200 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-colors"
          >
            I've saved it
          </button>
        </div>
      </div>
    </div>
  );
}
