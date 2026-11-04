import { cn } from '@/utils';
import type { ILoadingScreenProps } from './LoadingScreen.types';

export const LoadingScreen = (props: ILoadingScreenProps) => {
  const { label, layout = 'full-screen' } = props;
  const isEmbedded = layout === 'embedded';

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        isEmbedded
          ? 'app-shell-loading flex min-h-[40vh] items-center justify-center text-zinc-400'
          : 'min-h-screen flex items-center justify-center bg-[#09090b]'
      )}
    >
      <div className={isEmbedded ? undefined : 'text-zinc-400'}>{label}</div>
    </div>
  );
};
