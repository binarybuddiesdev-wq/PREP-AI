import { ArrowDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { LandingMetrics } from './LandingMetrics';
import type { ILandingHeroProps } from './LandingHero.types';

export const LandingHero = (props: ILandingHeroProps) => {
  const { signUpTo } = props;

  return (
    <section className="landing-hero" aria-labelledby="landing-title">
      <div className="landing-orb landing-orb--purple" aria-hidden="true" />
      <div className="landing-orb landing-orb--amber" aria-hidden="true" />
      <div className="landing-hero__copy">
        <p className="landing-chip">
          <span className="landing-chip__dot" aria-hidden="true" />
          NVIDIA NIM powered — now in beta
        </p>
        <h1 id="landing-title">
          The smarter way to
          <br />
          prepare for <em>interviews</em>
          <span>AI-crafted questions. Real-time feedback. Track every session.</span>
        </h1>
        <p className="landing-hero__description">
          Stop guessing what interviewers will ask. Practice with questions generated specifically
          for your target role, tech stack, and experience level.
        </p>
        <div className="landing-hero__actions">
          <Link
            className="landing-button landing-button--primary landing-button--large"
            to={signUpTo}
          >
            Start Practicing <ArrowRight aria-hidden="true" />
          </Link>
          <a
            className="landing-button landing-button--outline landing-button--large"
            href="#ld-feats"
          >
            See how it works <ArrowDown aria-hidden="true" />
          </a>
        </div>
        <LandingMetrics
          metrics={[
            { label: 'Questions', suffix: '+', target: 500 },
            { label: 'Sessions', suffix: 'k+', target: 12 },
            { decimal: true, label: 'User Rating', suffix: '', target: 4.9 },
          ]}
        />
      </div>
      <div className="landing-hero__preview">
        <div className="landing-terminal-glow" aria-hidden="true" />
        <div aria-label="Example PrepAI practice session" className="landing-terminal" role="group">
          <div className="landing-terminal__bar">
            <span className="landing-terminal__dot landing-terminal__dot--red" />
            <span className="landing-terminal__dot landing-terminal__dot--yellow" />
            <span className="landing-terminal__dot landing-terminal__dot--green" />
            <span className="landing-terminal__title">prepai — session</span>
          </div>
          <div className="landing-terminal__body" aria-hidden="true">
            <p>
              <span className="landing-terminal__prompt">$</span>{' '}
              <span className="landing-terminal__command">
                prepai start --topic react --level senior
              </span>
            </p>
            <p className="landing-terminal__muted">Loading questions for React (Senior)...</p>
            <p aria-hidden="true">&nbsp;</p>
            <p>
              <span className="landing-terminal__highlight">Q1:</span>{' '}
              <span className="landing-terminal__command">
                Explain the difference between useEffect and useLayoutEffect.
              </span>
            </p>
            <p className="landing-terminal__muted">Your answer submitted →</p>
            <p aria-hidden="true">&nbsp;</p>
            <p>
              <span className="landing-terminal__success">✓ Score: 8.5/10</span>{' '}
              <span className="landing-terminal__muted">
                — Solid understanding. Add browser paint timing for depth.
              </span>
            </p>
            <p>
              <span className="landing-terminal__prompt">$</span>{' '}
              <span className="landing-terminal__cursor">_</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
