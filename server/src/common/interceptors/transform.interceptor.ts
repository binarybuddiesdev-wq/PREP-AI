import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import type { IResponse } from '@/types/index.js';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, IResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<IResponse<T>> {
    return next.handle().pipe(map(data => ({
      success: true,
      message: (data && typeof data === 'object' && 'message' in data ? (data as { message: string }).message : '') || 'Success',
      data: data && typeof data === 'object' && 'data' in data ? (data as { data: T }).data : (data as T),
    })));
  }
}
