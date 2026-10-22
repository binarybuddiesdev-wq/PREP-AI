import { cn } from '@/utils';
import { BrandLink } from './BrandLink';
import type { IAppHeaderProps } from './AppHeader.types';

export const AppHeader = (props: IAppHeaderProps) => {
  const { brandTo, maxWidthClassName, children } = props;

  return (
    <header className="border-b border-white/10 px-6 py-4">
      <div className={cn('mx-auto flex items-center justify-between', maxWidthClassName)}>
        <BrandLink to={brandTo} />
        {children}
      </div>
    </header>
  );
};
