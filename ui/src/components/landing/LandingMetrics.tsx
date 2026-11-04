import { useEffect, useRef, useState } from 'react';

import type { ILandingMetric, ILandingMetricsProps } from './LandingMetrics.types';

const formatMetric = (metric: ILandingMetric, progress: number) => {
  const value = metric.decimal
    ? (metric.target * progress).toFixed(1)
    : Math.floor(metric.target * progress).toString();
  return `${value}${metric.suffix}`;
};

export const LandingMetrics = (props: ILandingMetricsProps) => {
  const { metrics } = props;
  const metricsRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = metricsRef.current;
    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!element || prefersReducedMotion || !('IntersectionObserver' in window)) {
      setProgress(1);
      return;
    }

    let frameId = 0;
    let startTime = 0;
    const duration = 1100;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const animate = (time: number) => {
          if (!startTime) startTime = time;
          const nextProgress = Math.min((time - startTime) / duration, 1);
          setProgress(nextProgress);
          if (nextProgress < 1) frameId = window.requestAnimationFrame(animate);
        };
        frameId = window.requestAnimationFrame(animate);
      },
      { threshold: 0.3 }
    );

    observer.observe(element);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div aria-label="PrepAI highlights" className="landing-metrics" ref={metricsRef}>
      {metrics.map((metric) => (
        <div key={metric.label}>
          <strong>{formatMetric(metric, progress)}</strong>
          <span>{metric.label}</span>
        </div>
      ))}
    </div>
  );
};
