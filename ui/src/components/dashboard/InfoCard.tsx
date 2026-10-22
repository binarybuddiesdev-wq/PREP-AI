import { cn } from '@/utils';
import type { IInfoCardProps } from './InfoCard.types';

export const InfoCard = (props: IInfoCardProps) => {
  const { title, value, isMonospace = false } = props;

  return (
    <div className="bg-[#18181b] border border-white/10 rounded-xl p-6">
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className={cn('text-sm text-zinc-400', isMonospace && 'font-mono break-all')}>{value}</p>
    </div>
  );
};
