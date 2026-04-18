import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const TOKEN_KEY = 'lm_tenant_token';
const REFRESH_KEY = 'lm_tenant_refresh';
const RENTER_KEY = 'lm_tenant_renter_id';
const STATUS_KEY = 'lm_tenant_account_status';

export type TenantAccountStatus = 'active' | 'pending' | 'rejected';

function readStoredStatus(): TenantAccountStatus | null {
    const s = localStorage.getItem(STATUS_KEY);
    if (s === 'active' || s === 'pending' || s === 'rejected') return s;
    const rid = localStorage.getItem(RENTER_KEY);
    if (rid) return 'active';
    return null;
}

export const useAuthStore = defineStore('auth', () => {
    const accessToken = ref<string | null>(localStorage.getItem(TOKEN_KEY));
    const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_KEY));
    const renterId = ref<string | null>(localStorage.getItem(RENTER_KEY));
    const accountStatus = ref<TenantAccountStatus | null>(readStoredStatus());

    const isAuthenticated = computed(() => Boolean(accessToken.value));

    function setSession(
        token: string,
        refresh: string,
        rid: string | null,
        status?: TenantAccountStatus,
    ) {
        accessToken.value = token;
        refreshToken.value = refresh;
        renterId.value = rid;
        const st: TenantAccountStatus = status ?? (rid ? 'active' : 'pending');
        accountStatus.value = st;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(REFRESH_KEY, refresh);
        if (rid) {
            localStorage.setItem(RENTER_KEY, rid);
        } else {
            localStorage.removeItem(RENTER_KEY);
        }
        localStorage.setItem(STATUS_KEY, st);
    }

    function clearSession() {
        accessToken.value = null;
        refreshToken.value = null;
        renterId.value = null;
        accountStatus.value = null;
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(RENTER_KEY);
        localStorage.removeItem(STATUS_KEY);
    }

    return {
        accessToken,
        refreshToken,
        renterId,
        accountStatus,
        isAuthenticated,
        setSession,
        clearSession,
    };
});
