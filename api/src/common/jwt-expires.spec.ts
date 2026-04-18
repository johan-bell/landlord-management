import { ConfigService } from '@nestjs/config';
import { accessExpiresSeconds } from './jwt-expires';

function mockConfig(value: string): ConfigService {
    return {
        get: () => value,
    } as unknown as ConfigService;
}

describe('accessExpiresSeconds', () => {
    it('parses plain seconds', () => {
        expect(accessExpiresSeconds(mockConfig('900'))).toBe(900);
    });

    it('parses minutes suffix', () => {
        expect(accessExpiresSeconds(mockConfig('15m'))).toBe(900);
    });

    it('parses hours suffix', () => {
        expect(accessExpiresSeconds(mockConfig('2h'))).toBe(7200);
    });
});
