import { Link } from 'react-router-dom';

interface AuthSwitchLinkProps {
  question: string;
  linkText: string;
  to: string;
}

export default function AuthSwitchLink({ question, linkText, to }: AuthSwitchLinkProps) {
  return (
    <p className="mt-6 text-center text-sm text-neutral-400">
      {question}{' '}
      <Link to={to} className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
        {linkText}
      </Link>
    </p>
  );
}
