export interface ITraceContextCarrier {
  traceparent?: string;
  tracestate?: string;
}

export interface ITraceableJobData {
  requestId?: string;
  traceContext?: ITraceContextCarrier;
}
