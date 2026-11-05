import { ArrowDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

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
          AI-powered interview practice
        </p>
        <h1 id="landing-title">
          The smarter way to
          <br />
          prepare for <em>interviews</em>
          <span>Topic-focused questions. Clear feedback. Progress you can review.</span>
        </h1>
        <p className="landing-hero__description">
          Practice with questions focused on the topic and difficulty you choose, or study from your
          own documents.
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
        <ul aria-label="PrepAI capabilities" className="landing-proof-points">
          <li>
            <strong>Focus</strong>
            <span>Choose topics and difficulty</span>
          </li>
          <li>
            <strong>Feedback</strong>
            <span>Understand your answers</span>
          </li>
          <li>
            <strong>Progress</strong>
            <span>Review your practice history</span>
          </li>
        </ul>
      </div>
      <div className="landing-hero__preview">
        <div className="landing-terminal-glow" aria-hidden="true" />
        <div aria-label="PrepAI practice flow" className="landing-terminal" role="group">
          <div className="landing-terminal__bar">
            <span className="landing-terminal__dot landing-terminal__dot--red" />
            <span className="landing-terminal__dot landing-terminal__dot--yellow" />
            <span className="landing-terminal__dot landing-terminal__dot--green" />
            <span className="landing-terminal__title">prepai - practice flow</span>
          </div>
          <div className="landing-terminal__body">
            <p>
              <span className="landing-terminal__prompt">01</span>{' '}
              <span className="landing-terminal__command">
                Choose a topic and target difficulty
              </span>
            </p>
            <p className="landing-terminal__muted">
              Questions match the topic and difficulty you chose.
            </p>
            <p aria-hidden="true">&nbsp;</p>
            <p>
              <span className="landing-terminal__highlight">02</span>{' '}
              <span className="landing-terminal__command">Answer in your own words</span>
            </p>
            <p className="landing-terminal__muted">
              Use your own experience to explain your thinking.
            </p>
            <p aria-hidden="true">&nbsp;</p>
            <p>
              <span className="landing-terminal__success">03</span>{' '}
              <span className="landing-terminal__command">
                Review feedback and choose a next step
              </span>
            </p>
            <p>
              <span className="landing-terminal__prompt">&gt;</span>{' '}
              <span className="landing-terminal__cursor">Your progress stays in your history.</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
