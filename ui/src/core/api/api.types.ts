export interface IApiEnvelope<TData> {
  success: boolean;
  message: string;
  data: TData;
}

export interface IPaginationRequest {
  page: number;
  limit: number;
}
