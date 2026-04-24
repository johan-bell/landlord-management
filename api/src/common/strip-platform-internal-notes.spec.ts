import { stripPlatformInternalNotes } from './strip-platform-internal-notes';

describe('stripPlatformInternalNotes', () => {
    it('removes platformInternalNotes and keeps other fields', () => {
        const row = {
            id: '1',
            name: 'Acme',
            platformInternalNotes: 'secret',
            count: 2,
        };
        const out = stripPlatformInternalNotes(row);
        expect(out).toEqual({ id: '1', name: 'Acme', count: 2 });
        expect('platformInternalNotes' in out).toBe(false);
    });

    it('works when notes field is absent', () => {
        const row = { id: '2', name: 'Beta' };
        const out = stripPlatformInternalNotes(
            row as { id: string; name: string } & Record<string, unknown>,
        );
        expect(out).toEqual(row);
    });
});
