import { Link } from 'react-router';
import { cn } from '@/utils';
import type { IBrandLinkProps } from './BrandLink.types';

const SIZE_CLASSES = {
  small: { link: 'text-lg', badge: 'w-7 h-7 text-xs' },
  large: { link: 'text-xl text-white', badge: 'w-8 h-8 text-sm' },
} as const;

export const BrandLink = (props: IBrandLinkProps) => {
  const { to, size = 'small' } = props;
  const classes = SIZE_CLASSES[size];

  return (
    <Link to={to} className={cn('inline-flex items-center gap-2 font-bold', classes.link)}>
      <div
        className={cn(
          'rounded-lg bg-amber-500 flex items-center justify-center text-black font-extrabold',
          classes.badge
        )}
      >
        P
      </div>
      PrepAI
    </Link>
  );
};
