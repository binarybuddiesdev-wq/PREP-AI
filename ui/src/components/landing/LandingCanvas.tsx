import { useEffect, useRef } from 'react';

import type { ILandingCanvasParticle, ILandingCanvasProps } from './LandingCanvas.types';

const PARTICLE_COUNT = 42;

export const LandingCanvas = (props: ILandingCanvasProps) => {
  const { theme } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const prefersReducedMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let frameId = 0;
    let canvasWidth = window.innerWidth;
    let canvasHeight = window.innerHeight;
    const particles: ILandingCanvasParticle[] = Array.from({ length: PARTICLE_COUNT }, () => ({
      x: Math.random() * canvasWidth,
      y: Math.random() * canvasHeight,
      radius: Math.random() * 1.4 + 0.4,
      speedX: (Math.random() - 0.5) * 0.18,
      speedY: (Math.random() - 0.5) * 0.18,
    }));

    const resizeCanvas = () => {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      canvasWidth = window.innerWidth;
      canvasHeight = window.innerHeight;
      canvas.width = canvasWidth * pixelRatio;
      canvas.height = canvasHeight * pixelRatio;
      canvas.style.width = `${canvasWidth}px`;
      canvas.style.height = `${canvasHeight}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = () => {
      context.clearRect(0, 0, canvasWidth, canvasHeight);
      context.fillStyle = theme === 'dark' ? 'rgba(245,158,11,.38)' : 'rgba(180,83,9,.22)';
      for (const particle of particles) {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
        if (!prefersReducedMotion) {
          particle.x = (particle.x + particle.speedX + canvasWidth) % canvasWidth;
          particle.y = (particle.y + particle.speedY + canvasHeight) % canvasHeight;
        }
      }
      if (!prefersReducedMotion) frameId = window.requestAnimationFrame(draw);
    };

    resizeCanvas();
    draw();
    if (!prefersReducedMotion) window.addEventListener('resize', resizeCanvas);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [theme]);

  return (
    <canvas aria-hidden="true" className="landing-canvas" ref={canvasRef} role="presentation" />
  );
};
