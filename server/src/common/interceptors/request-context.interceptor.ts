import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { runWithRequestId } from '../request-context/request-context.js';

interface IRequestWithId {
  id?: unknown;
}

@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const requestId = context.switchToHttp().getRequest<IRequestWithId>().id;
    if (typeof requestId !== 'string') return next.handle();

    return new Observable((subscriber) =>
      runWithRequestId(requestId, () => next.handle().subscribe(subscriber))
    );
  }
}
