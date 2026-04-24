export type OperationResult<T = void> = T extends void
    ? { success: true } | { success: false; error: string }
    : { success: true; data: T } | { success: false; error: string };

export function ok(): { success: true };
export function ok<T>(data: T): { success: true; data: T };
export function ok<T>(data?: T) {
    return data !== undefined ? { success: true, data } : { success: true };
}

export function fail(error: string): { success: false; error: string } {
    return { success: false, error };
}
