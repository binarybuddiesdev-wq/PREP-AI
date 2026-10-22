import type { IWelcomeHeadingProps } from './WelcomeHeading.types';

export const WelcomeHeading = (props: IWelcomeHeadingProps) => {
  const { name } = props;

  return (
    <>
      <h1 className="text-2xl font-bold mb-2">Welcome, {name}</h1>
      <p className="text-zinc-400 mb-8">You&apos;re signed in. This is your dashboard.</p>
    </>
  );
};
