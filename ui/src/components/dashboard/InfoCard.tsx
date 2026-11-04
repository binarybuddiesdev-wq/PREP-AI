import { cn } from '@/utils';
import type { IInfoCardProps } from './InfoCard.types';

export const InfoCard = (props: IInfoCardProps) => {
  const { title, value, isMonospace = false } = props;

  return (
    <div className="app-shell-panel rounded-xl border border-white/10 bg-[#18181b] p-6">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className={cn('text-sm text-zinc-400', isMonospace && 'font-mono break-all')}>{value}</p>
    </div>
  );
};
