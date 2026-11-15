import { Fragment, memo, useMemo } from 'react';
import { parseQuizMarkdown, type InlineToken } from '../../lib/quizMarkdown';

const INLINE_CLASS: Record<InlineToken['type'], string> = {
  text: '',
  bold: 'font-semibold text-white',
  italic: 'italic',
  code: 'rounded bg-neutral-800 px-1 py-0.5 font-mono text-[0.9em] text-violet-200',
};

function Inline({ token }: { token: InlineToken }) {
  if (token.type === 'text') return <>{token.text}</>;
  const Tag = token.type === 'code' ? 'code' : token.type === 'bold' ? 'strong' : 'em';
  return <Tag className={INLINE_CLASS[token.type]}>{token.text}</Tag>;
}

interface QuizRichTextProps {
  text: string;
  className?: string;
}

// Texto do quiz como elementos React: nunca HTML vindo do ficheiro.
function QuizRichText({ text, className = '' }: QuizRichTextProps) {
  const blocks = useMemo(() => parseQuizMarkdown(text), [text]);
  return (
    <div className={`space-y-2 break-words ${className}`}>
      {blocks.map((block, i) =>
        block.type === 'code' ? (
          <pre key={i} className="overflow-x-auto rounded-lg border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs leading-relaxed text-neutral-200">
            {block.text}
          </pre>
        ) : (
          <p key={i}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {line.map((token, k) => (
                  <Inline key={k} token={token} />
                ))}
              </Fragment>
            ))}
          </p>
        ),
      )}
    </div>
  );
}

export default memo(QuizRichText);
