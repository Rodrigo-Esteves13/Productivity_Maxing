const FAQ_ITEMS = [
  {
    question: 'Is Productivity Maxing free?',
    answer:
      'Yes, completely. It\'s an independent, open-source project, not a business with a pricing page - there\'s no paid tier, no upsell, and no plan to add one.',
  },
  {
    question: 'Who can see my tasks and grades?',
    answer:
      'Only you. There\'s no social or sharing feature, no public profile, and no analytics service that profiles visitors - see the Privacy Policy for the full breakdown of what\'s collected and why.',
  },
  {
    question: 'What does the Google Calendar permission actually do?',
    answer:
      'It lets the app create and update calendar events for the deadlines you set inside it, so they show up on your calendar automatically. It never reads or touches events it didn\'t create, and you can revoke access at any time from your Google account settings.',
  },
  {
    question: 'What\'s the Windows agent, and do I need it?',
    answer:
      'It\'s an optional companion app that shows your task status in the background and can block distracting sites during a focus session. Entirely optional - the web app is fully functional without it.',
  },
  {
    question: 'Can I self-host it or contribute?',
    answer:
      'The full source is public on GitHub under the MIT License - clone it, run it yourself, or open a pull request.',
  },
];

// <details>/<summary> instead of a custom accordion component - free
// keyboard support, no JS state, and it's inert content that doesn't need
// more than that.
export default function FaqSection() {
  return (
    <section className="mt-20 max-w-3xl mx-auto w-full text-left" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-2xl font-bold text-white text-center mb-8">
        Frequently asked questions
      </h2>
      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.question}
            className="group bg-neutral-900/50 border border-neutral-800 rounded-xl px-5 py-4 open:pb-4"
          >
            <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-medium text-white">
              {item.question}
              <span className="shrink-0 text-neutral-500 transition-transform group-open:rotate-45 text-xl leading-none">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm text-neutral-400 leading-relaxed">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
