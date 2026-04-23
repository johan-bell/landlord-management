import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(PrismaExceptionFilter.name);

    catch(error: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'Database error';

        switch (error.code) {
            case 'P2002': {
                status = HttpStatus.CONFLICT;
                const fields = Array.isArray(error.meta?.target)
                    ? (error.meta.target as string[]).join(', ')
                    : 'field';
                message = `A record with this ${fields} already exists`;
                break;
            }
            case 'P2025':
                status = HttpStatus.NOT_FOUND;
                message = 'Record not found';
                break;
            case 'P2003':
                status = HttpStatus.BAD_REQUEST;
                message = 'Related record not found';
                break;
            case 'P2014':
                status = HttpStatus.BAD_REQUEST;
                message = 'The provided relation is invalid';
                break;
            case 'P2016':
                status = HttpStatus.NOT_FOUND;
                message = 'Record not found';
                break;
            default:
                this.logger.error(
                    `Unhandled Prisma error [${error.code}]: ${error.message}`,
                );
        }

        response.status(status).json({
            statusCode: status,
            message,
            error: HttpStatus[status],
        });
    }
}
