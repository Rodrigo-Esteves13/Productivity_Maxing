import { useState } from 'react';
import { CopyIcon, CheckIcon } from './Icons';
import { COPY_FEEDBACK_MS } from '../../lib/constants';

interface CopyButtonProps {
  /** The text copied to the clipboard when clicked. */
  text: string;
  /** Optional label shown next to the icon. Omit for an icon-only button. */
  label?: string;
  className?: string;
}

// Same copy/feedback pattern NewApiKeyModal.tsx already had inline -
// pulled out so it can be reused anywhere else a "copy this" affordance is
// useful (e.g. the agent setup command) without re-implementing the
// clipboard call and the timed "Copied!" state each time.
export default function CopyButton({ text, label = 'Copy', className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs font-semibold text-neutral-200 transition-colors ${className}`}
    >
      {copied ? <CheckIcon className="w-3.5 h-3.5 text-emerald-400" /> : <CopyIcon className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
