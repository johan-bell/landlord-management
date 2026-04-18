import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const TOKEN_KEY = 'lm_platform_token';
const REFRESH_KEY = 'lm_platform_refresh';
const USER_KEY = 'lm_platform_user';

export type AuthUser = {
    id: string;
    email: string;
    name: string | null;
    isPlatformAdmin: boolean;
};

function loadStoredUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem(USER_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as AuthUser;
    } catch {
        return null;
    }
}

export const useAuthStore = defineStore('auth', () => {
    const accessToken = ref<string | null>(localStorage.getItem(TOKEN_KEY));
    const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY));
    const user = ref<AuthUser | null>(loadStoredUser());

    const isAuthenticated = computed(() => Boolean(accessToken.value));

    function setSession(token: string, refresh: string, u: AuthUser) {
        accessToken.value = token;
        refreshToken.value = refresh;
        user.value = u;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(REFRESH_KEY, refresh);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
    }

    function clearSession() {
        accessToken.value = null;
        refreshToken.value = null;
        user.value = null;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
    }

    return {
        accessToken,
        refreshToken,
        user,
        isAuthenticated,
        setSession,
        clearSession,
    };
});
