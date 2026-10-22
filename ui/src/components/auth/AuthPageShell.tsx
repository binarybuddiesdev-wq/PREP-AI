import { Link } from 'react-router';
import { BrandLink } from '../layout';
import type { IAuthPageShellProps } from './AuthPageShell.types';

export const AuthPageShell = (props: IAuthPageShellProps) => {
  const { brandTo, footerPrompt, footerLinkTo, footerLinkLabel, children } = props;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <BrandLink to={brandTo} size="large" />
        </div>
        {children}
        <p className="text-center text-sm text-zinc-500 mt-6">
          {footerPrompt}{' '}
          <Link to={footerLinkTo} className="text-amber-500 hover:text-amber-400 font-medium">
            {footerLinkLabel}
          </Link>
        </p>
      </div>
    </div>
  );
};
