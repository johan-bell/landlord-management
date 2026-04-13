import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const TOKEN_KEY = 'lm_admin_token';
const USER_KEY = 'lm_admin_user';

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
    const user = ref<AuthUser | null>(loadStoredUser());

    const isAuthenticated = computed(() => Boolean(accessToken.value));

    function setSession(token: string, u: AuthUser) {
        accessToken.value = token;
        user.value = u;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(u));
    }

    function clearSession() {
        accessToken.value = null;
        user.value = null;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    return {
        accessToken,
        user,
        isAuthenticated,
        setSession,
        clearSession,
    };
});
