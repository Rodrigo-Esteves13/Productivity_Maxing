import { useI18n } from '../../i18n/useI18n';

const VISIBLE = 2;

// Small neutral chips; the rest collapse into "+n" (full list in the title).
export default function TagChips({ tags }: { tags?: string[] }) {
  const { t } = useI18n();
  if (!tags?.length) return null;
  const extra = tags.length - VISIBLE;
  return (
    <>
      {tags.slice(0, VISIBLE).map((tag) => (
        <span
          key={tag}
          className="max-w-[7rem] truncate rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300"
        >
          #{tag}
        </span>
      ))}
      {extra > 0 && (
        <span
          title={tags.join(', ')}
          className="rounded-full bg-neutral-800 px-2 py-0.5 text-[11px] tabular-nums text-neutral-400"
        >
          {t('tags.more', { n: extra })}
        </span>
      )}
    </>
  );
}
