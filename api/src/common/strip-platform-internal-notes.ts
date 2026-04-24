/** Remove `platformInternalNotes` from API responses (platform operator field). */
export function stripPlatformInternalNotes<T extends Record<string, unknown>>(
    row: T,
): Omit<T, 'platformInternalNotes'> {
    const copy = { ...row };
    delete copy.platformInternalNotes;
    return copy as Omit<T, 'platformInternalNotes'>;
}
