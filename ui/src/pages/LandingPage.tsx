import { useEffect } from 'react';

import {
  LandingCanvas,
  LandingFooter,
  LandingHero,
  LandingNav,
  LandingSections,
} from '@/components/landing';
import { ROUTES } from '@/core';
import { useThemePreference } from '@/logic';

export const LandingPage = () => {
  const { theme, toggleTheme } = useThemePreference();

  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>('.landing-reveal');
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      elements.forEach((element) => element.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing" data-theme={theme}>
      <LandingNav
        homeTo={ROUTES.root}
        onToggleTheme={toggleTheme}
        signInTo={ROUTES.signIn}
        signUpTo={ROUTES.signUp}
        theme={theme}
      />
      <main>
        <LandingHero signUpTo={ROUTES.signUp} />
        <LandingCanvas theme={theme} />
        <LandingSections signUpTo={ROUTES.signUp} />
      </main>
      <LandingFooter year={new Date().getFullYear()} />
    </div>
  );
};
