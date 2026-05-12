import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { RenterDocumentsController } from './renter-documents.controller';
import { RenterDocumentsService } from './renter-documents.service';

@Module({
    imports: [PrismaModule, StorageModule, AuditModule],
    controllers: [RenterDocumentsController],
    providers: [RenterDocumentsService],
    exports: [RenterDocumentsService],
})
export class RenterDocumentsModule {}
