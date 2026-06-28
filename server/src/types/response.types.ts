export interface IResponse<T> {
  success: boolean;
  message: string;
  data: T;
  path?: string;
  timestamp?: string;
}
