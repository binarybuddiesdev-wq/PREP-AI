export type DependencyStatus = 'up' | 'down' | 'skipped';

export interface IDependencyReport {
  status: DependencyStatus;
  latencyMs?: number;
  error?: string;
}

export interface IReadinessReport {
  status: 'ready' | 'not-ready' | 'degraded';
  checks: {
    mongo: IDependencyReport;
    postgres: IDependencyReport;
    redis: IDependencyReport;
  };
  timestamp: string;
}

export interface ILivenessReport {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}
