import { useI18n } from '../../i18n/useI18n';
// Chaves i18n (pergunta/resposta), traduzidas no render.
// Chaves i18n (pergunta/resposta), traduzidas no render.
const FAQ_ITEMS = [
  { question: 'faq.qFree', answer: 'faq.aFree' },
  { question: 'faq.qPrivacy', answer: 'faq.aPrivacy' },
  { question: 'faq.qCalendar', answer: 'faq.aCalendar' },
  { question: 'faq.qAgent', answer: 'faq.aAgent' },
  { question: 'faq.qSelfHost', answer: 'faq.aSelfHost' },
];

// <details>/<summary> instead of a custom accordion component - free
// keyboard support, no JS state, and it's inert content that doesn't need
// more than that.
export default function FaqSection() {
  const { t } = useI18n();
  return (
    <section className="mt-20 max-w-3xl mx-auto w-full text-left" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-2xl font-bold text-white text-center mb-8">
        {t('ui.frequentlyAskedQuestions')}
      </h2>
      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={t(item.question)}
            className="group bg-neutral-900/50 border border-neutral-800 rounded-xl px-5 py-4 open:pb-4"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-white">
              {t(item.question)}
              <span className="shrink-0 text-neutral-500 transition-transform group-open:rotate-45 text-xl leading-none">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{t(item.answer)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
