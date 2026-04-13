import { useAuthStore } from '../stores/auth';

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

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
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

    if (res.status === 401 && hadToken && !path.startsWith('/tenant/auth')) {
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
