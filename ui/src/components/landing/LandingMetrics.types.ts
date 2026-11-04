export interface ILandingMetric {
  label: string;
  suffix: string;
  target: number;
  decimal?: boolean;
}

export interface ILandingMetricsProps {
  metrics: readonly ILandingMetric[];
}
