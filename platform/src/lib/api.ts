import { useAuthStore } from '../stores/auth';
import type { AuthUser } from '../stores/auth';

let refreshInFlight: Promise<boolean> | null = null;

function apiBase(): string {
    const raw = import.meta.env.VITE_API_URL as string | undefined;
    if (raw) {
        return raw.replace(/\/$/, '');
    }
    return '';
}

export function getAuthHeaders(): Record<string, string> {
    const auth = useAuthStore();
    const token = auth.accessToken;
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
}

export async function tryRefreshAccess(): Promise<boolean> {
    if (refreshInFlight) {
        return refreshInFlight;
    }
    refreshInFlight = (async () => {
    const auth = useAuthStore();
    const rt = auth.refreshToken;
    if (!rt || !auth.user) {
        return false;
    }
    const url = `${apiBase()}/auth/refresh`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: rt }),
        });
        if (!res.ok) {
            return false;
        }
        const data = (await res.json()) as {
            access_token: string;
            refresh_token: string;
            user: AuthUser;
        };
        auth.setSession(data.access_token, data.refresh_token, data.user);
        return true;
    } catch {
        return false;
    }
    })();
    try {
        return await refreshInFlight;
    } finally {
        refreshInFlight = null;
    }
}

export async function api<T>(
    path: string,
    init?: RequestInit,
    isRetry = false,
): Promise<T> {
    const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`;
    const auth = useAuthStore();
    const hadToken = Boolean(auth.accessToken);

    const res = await fetch(url, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
            ...(init?.headers ?? {}),
        },
    });

    if (
        res.status === 401 &&
        hadToken &&
        !isRetry &&
        !path.startsWith('/auth/')
    ) {
        const refreshed = await tryRefreshAccess();
        if (refreshed) {
            return api<T>(path, init, true);
        }
        auth.clearSession();
        window.location.href = `${import.meta.env.BASE_URL}login`;
    }

    if (!res.ok) {
        const text = await res.text();
        let message = res.statusText;
        try {
            const j = JSON.parse(text) as { message?: string | string[] };
            if (typeof j.message === 'string') message = j.message;
            else if (Array.isArray(j.message)) message = j.message.join(', ');
        } catch {
            if (text) message = text;
        }
        throw new Error(message);
    }
    if (res.status === 204) {
        return undefined as T;
    }
    return (await res.json()) as T;
}
