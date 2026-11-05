import { Check } from 'lucide-react';
import { useState, type CSSProperties, type PointerEvent } from 'react';

import { cn } from '@/utils';

import type { ILandingShowcaseProps } from './LandingShowcase.types';

export const LandingShowcase = (props: ILandingShowcaseProps) => {
  const { className } = props;
  const [rotation, setRotation] = useState({ x: 6, y: -8 });

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    const horizontalPosition = (event.clientX - bounds.left) / bounds.width;
    const verticalPosition = (event.clientY - bounds.top) / bounds.height;
    setRotation({
      x: 6 - (verticalPosition - 0.5) * 8,
      y: -8 + (horizontalPosition - 0.5) * 10,
    });
  };

  const panelStyle = {
    '--landing-rotate-x': `${rotation.x}deg`,
    '--landing-rotate-y': `${rotation.y}deg`,
  } as CSSProperties;

  return (
    <div className={cn('landing-showcase', className)}>
      <div className="landing-showcase__stage">
        <div
          aria-label="Practice feedback overview"
          className="landing-showcase__panel"
          onPointerLeave={() => setRotation({ x: 6, y: -8 })}
          onPointerMove={handlePointerMove}
          role="group"
          style={panelStyle}
        >
          <div className="landing-showcase__face">
            <div className="landing-showcase__bar">
              <span className="landing-terminal__dot landing-terminal__dot--red" />
              <span className="landing-terminal__dot landing-terminal__dot--yellow" />
              <span className="landing-terminal__dot landing-terminal__dot--green" />
              <span className="landing-showcase__title">prepai - feedback overview</span>
            </div>
            <div className="landing-showcase__body">
              <div className="landing-showcase__question">
                <span className="landing-showcase__label">AFTER YOU SUBMIT AN ANSWER</span>
                <p>Your answer is scored for accuracy, completeness, clarity, and depth.</p>
                <ul className="landing-showcase__feedback-list">
                  <li>
                    <Check aria-hidden="true" />
                    <span>An AI-generated score</span>
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    <span>Written feedback on your response</span>
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    <span>A session history you can review</span>
                  </li>
                </ul>
              </div>
              <div className="landing-showcase__feedback">
                <span className="landing-feedback-label">Answer evaluation</span>
                <p>Score and written feedback</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
