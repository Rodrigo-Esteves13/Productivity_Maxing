import { GithubIcon, ArrowUpRightIcon } from '../UI/Icons';

const REPO_URL = 'https://github.com/Rodrigo-Esteves13/Productivity_Maxing';

export default function FooterBrand() {
  return (
    <div className="max-w-sm">
      <span className="text-xl font-bold tracking-wider bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
        Productivity Maxing
      </span>
      <p className="mt-3 text-sm text-neutral-400 leading-relaxed">
        Track your tasks, crush your deadlines, and actually see the grind pay off.
      </p>

      <a
        href={REPO_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors group"
      >
        <GithubIcon />
        <span>Star it on GitHub</span>
        <ArrowUpRightIcon className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
      </a>
    </div>
  );
}
