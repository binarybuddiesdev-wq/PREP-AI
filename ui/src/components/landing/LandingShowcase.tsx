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
          aria-label="Example practice question and feedback"
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
              <span className="landing-showcase__title">prepai — practice session</span>
            </div>
            <div className="landing-showcase__body">
              <div className="landing-showcase__question">
                <span className="landing-showcase__label">QUESTION 4 OF 10 — REACT, SENIOR</span>
                <p>How would you prevent unnecessary re-renders in a list of 10,000 items?</p>
                <p className="landing-showcase__answer">
                  I'd wrap the component in React.memo and virtualize the list so we're not mounting
                  every row at once...
                </p>
              </div>
              <div className="landing-showcase__feedback">
                <div className="landing-score-ring">
                  <div>
                    <strong>8.5</strong>
                    <span>/ 10</span>
                  </div>
                </div>
                <p>Excellent answer</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
