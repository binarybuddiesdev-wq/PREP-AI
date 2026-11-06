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
          NVIDIA NIM powered &mdash; now in beta
        </p>
        <h1 id="landing-title">
          <span className="landing-hero__title-line">The smarter way to</span>
          <span className="landing-hero__title-line">
            prepare for <em>interviews</em>
          </span>
          <span className="landing-hero__subtitle">
            AI-crafted questions. Real-time feedback. Track every session.
          </span>
        </h1>
        <p className="landing-hero__description">
          Practice with questions focused on the topic and difficulty you choose, or study from your
          own documents. Review feedback to choose your next topic.
        </p>
        <div className="landing-hero__actions">
          <Link
            className="landing-button landing-button--primary landing-button--large"
            to={signUpTo}
          >
            Start Practicing
          </Link>
          <a
            className="landing-button landing-button--outline landing-button--large"
            href="#ld-feats"
          >
            See how it works
          </a>
        </div>
        <ul aria-label="PrepAI capabilities" className="landing-proof-points">
          <li>
            <strong>Focus</strong>
            <span>Topics &amp; level</span>
          </li>
          <li>
            <strong>Feedback</strong>
            <span>Answer feedback</span>
          </li>
          <li>
            <strong>Progress</strong>
            <span>Session history</span>
          </li>
        </ul>
      </div>
      <div className="landing-hero__preview">
        <div className="landing-terminal-glow" aria-hidden="true" />
        <div aria-label="PrepAI practice session" className="landing-terminal" role="group">
          <div className="landing-terminal__bar">
            <span className="landing-terminal__dot landing-terminal__dot--red" />
            <span className="landing-terminal__dot landing-terminal__dot--yellow" />
            <span className="landing-terminal__dot landing-terminal__dot--green" />
            <span className="landing-terminal__title">prepai &mdash; session</span>
          </div>
          <div className="landing-terminal__body">
            <p>
              <span className="landing-terminal__prompt">$</span>{' '}
              <span className="landing-terminal__command">
                prepai start &lt;topic&gt; &lt;level&gt;
              </span>
            </p>
            <p className="landing-terminal__muted">Questions match your chosen topic.</p>
            <p aria-hidden="true">&nbsp;</p>
            <p>
              <span className="landing-terminal__highlight">Q1:</span>{' '}
              <span className="landing-terminal__command">
                A question based on your topic and target difficulty appears here.
              </span>
            </p>
            <p className="landing-terminal__muted">Your answer has been submitted.</p>
            <p aria-hidden="true">&nbsp;</p>
            <p>
              <span className="landing-terminal__success">✓</span>{' '}
              <span className="landing-terminal__command">
                Score and written feedback explain what to improve next and why.
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
