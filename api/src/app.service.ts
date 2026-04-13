import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHealth() {
        return {
            ok: true,
            service: 'landlord-management-api',
            version: '0.1.0',
        };
    }
}
