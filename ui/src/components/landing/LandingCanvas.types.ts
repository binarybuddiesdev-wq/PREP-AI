import type { Theme } from '@/core';

export interface ILandingCanvasProps {
  theme: Theme;
}

export interface ILandingCanvasParticle {
  x: number;
  y: number;
  radius: number;
  speedX: number;
  speedY: number;
}
