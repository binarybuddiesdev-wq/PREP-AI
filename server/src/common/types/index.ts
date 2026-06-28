export interface MiddlewareConfig {
  cors: {
    origin: string;
    credentials: boolean;
  };
  rateLimit: {
    max: number;
    timeWindow: string;
  };
  authRateLimit: {
    max: number;
    timeWindow: string;
  };
}
