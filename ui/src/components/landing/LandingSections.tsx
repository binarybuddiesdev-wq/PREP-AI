import { Link } from 'react-router';

import type { ILandingSectionsProps } from './LandingSections.types';
import { LandingShowcase } from './LandingShowcase';

export const LandingSections = (props: ILandingSectionsProps) => {
  const { signUpTo } = props;

  return (
    <>
      <section
        aria-labelledby="landing-features-title"
        className="landing-section landing-reveal"
        id="ld-feats"
      >
        <div className="landing-section__head">
          <p className="landing-section__label">See it work</p>
          <h2 className="landing-section__title" id="landing-features-title">
            Feedback that reads like a senior engineer wrote it
          </h2>
          <p className="landing-section__subtitle">
            Not a bare score. A real answer, graded, with the reasoning shown — this is an actual
            practice session.
          </p>
        </div>
        <LandingShowcase />
      </section>
      <section
        aria-labelledby="landing-difference-title"
        className="landing-section landing-reveal"
      >
        <div className="landing-section__head">
          <p className="landing-section__label">Built differently</p>
          <h2 className="landing-section__title" id="landing-difference-title">
            Three things a static question bank can't do
          </h2>
        </div>
        <div className="landing-statements">
          <article className="landing-statement">
            <span>01</span>
            <h3>Adapts every question</h3>
            <p>
              Nail three in a row and the next one gets harder. Miss the fundamentals and it backs
              off automatically — no settings screen, it just happens.
            </p>
          </article>
          <article className="landing-statement">
            <span>02</span>
            <h3>Explains the score</h3>
            <p>
              What you got right, what's missing, and the exact phrase to add next time — not just a
              number.
            </p>
          </article>
          <article className="landing-statement">
            <span>03</span>
            <h3>Finds your gaps first</h3>
            <p>
              No self-assessment quiz. After a few sessions we already know where you're strong and
              where you're not.
            </p>
          </article>
        </div>
      </section>
      <section
        aria-labelledby="landing-how-title"
        className="landing-section landing-reveal"
        id="ld-how"
      >
        <div className="landing-section__head">
          <p className="landing-section__label">The loop</p>
          <h2 className="landing-section__title" id="landing-how-title">
            Four steps, every session
          </h2>
        </div>
        <div className="landing-steps">
          <article>
            <h3>Pick your stack</h3>
            <p>React, TypeScript, System Design, DSA, Node, NestJS and 14 more.</p>
          </article>
          <article>
            <h3>Answer for real</h3>
            <p>Timed, typed, no multiple choice — no judgment, just practice.</p>
          </article>
          <article>
            <h3>Get graded</h3>
            <p>Score plus the reasoning behind it, in seconds.</p>
          </article>
          <article>
            <h3>Watch gaps close</h3>
            <p>Each session targets what your last one exposed.</p>
          </article>
        </div>
      </section>
      <section
        aria-labelledby="landing-results-title"
        className="landing-section landing-reveal"
        id="ld-stats"
      >
        <div className="landing-section__head">
          <p className="landing-section__label">In practice</p>
          <h2 className="landing-section__title" id="landing-results-title">
            Scores that actually move
          </h2>
        </div>
        <div className="landing-results">
          <article>
            <strong>4.2→8.3</strong>
            <span>Avg. system design score, first 10 sessions</span>
          </article>
          <article>
            <strong>31→84%</strong>
            <span>MongoDB score after two focused weeks</span>
          </article>
          <article>
            <strong>12</strong>
            <span>Sessions to a first "you're ready" verdict</span>
          </article>
        </div>
      </section>
      <section aria-labelledby="landing-cta-title" className="landing-cta landing-reveal">
        <div>
          <h2 id="landing-cta-title">Stop guessing. Start practicing.</h2>
          <p>Free to start. No credit card. Cancel anytime.</p>
          <Link className="landing-button landing-button--cta" to={signUpTo}>
            Get Started Free <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>
    </>
  );
};
