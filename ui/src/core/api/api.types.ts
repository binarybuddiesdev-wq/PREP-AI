export interface IApiEnvelope<TData> {
  success: boolean;
  message: string;
  data: TData;
}
