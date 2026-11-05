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
            Feedback that explains what to improve
          </h2>
          <p className="landing-section__subtitle">
            See an AI score and written feedback for each answer, then use your session history and
            weak areas to choose what to practice next.
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
            Practice with useful feedback and a clear next step
          </h2>
        </div>
        <div className="landing-statements">
          <article className="landing-statement">
            <span>01</span>
            <h3>Choose your challenge</h3>
            <p>Set a topic and target difficulty for each practice session.</p>
          </article>
          <article className="landing-statement">
            <span>02</span>
            <h3>Understand your feedback</h3>
            <p>Review the score and written feedback for each answer.</p>
          </article>
          <article className="landing-statement">
            <span>03</span>
            <h3>Find your focus</h3>
            <p>Use saved scores and weak-area results to decide what to practice next.</p>
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
            <h3>Choose a topic or document</h3>
            <p>Choose from available interview topics or study from your own documents.</p>
          </article>
          <article>
            <h3>Write your answer</h3>
            <p>Answer in your own words. PrepAI records your elapsed time.</p>
          </article>
          <article>
            <h3>Review your answer</h3>
            <p>See an AI-generated score and written feedback on your answer.</p>
          </article>
          <article>
            <h3>Review your progress</h3>
            <p>Use your session history and weak areas to guide what you practice next.</p>
          </article>
        </div>
      </section>
      <section
        aria-labelledby="landing-results-title"
        className="landing-section landing-reveal"
        id="ld-stats"
      >
        <div className="landing-section__head">
          <p className="landing-section__label">A useful practice loop</p>
          <h2 className="landing-section__title" id="landing-results-title">
            Practice that keeps your next step clear
          </h2>
        </div>
        <div className="landing-results">
          <article>
            <strong>Focus</strong>
            <span>Choose topics and difficulty that fit your interview goals.</span>
          </article>
          <article>
            <strong>Feedback</strong>
            <span>Understand the strengths and gaps in each submitted answer.</span>
          </article>
          <article>
            <strong>Progress</strong>
            <span>Review past sessions and use weak areas to plan what comes next.</span>
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
