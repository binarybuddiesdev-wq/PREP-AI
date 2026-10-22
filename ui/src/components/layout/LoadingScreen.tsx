import type { ILoadingScreenProps } from './LoadingScreen.types';

export const LoadingScreen = (props: ILoadingScreenProps) => {
  const { label } = props;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
      <div className="text-zinc-400">{label}</div>
    </div>
  );
};
