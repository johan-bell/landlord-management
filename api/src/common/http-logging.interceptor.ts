import {
    CallHandler,
    ExecutionContext,
    Injectable,
    Logger,
    NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { getRequestId } from './request-context';

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<unknown> {
        if (context.getType() !== 'http') {
            return next.handle();
        }
        const req = context.switchToHttp().getRequest<{
            method: string;
            url: string;
        }>();
        const res = context
            .switchToHttp()
            .getResponse<{ statusCode: number }>();
        const start = Date.now();
        const requestId = getRequestId();
        return next.handle().pipe(
            finalize(() => {
                this.logger.log(
                    JSON.stringify({
                        requestId,
                        method: req.method,
                        path: req.url,
                        statusCode: res.statusCode,
                        durationMs: Date.now() - start,
                    }),
                );
            }),
        );
    }
}
