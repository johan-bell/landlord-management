import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const TOKEN_KEY = 'lm_tenant_token';
const RENTER_KEY = 'lm_tenant_renter_id';

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const renterId = ref<string | null>(localStorage.getItem(RENTER_KEY));

  const isAuthenticated = computed(() => Boolean(accessToken.value));

  function setSession(token: string, rid: string) {
    accessToken.value = token;
    renterId.value = rid;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(RENTER_KEY, rid);
  }

  function clearSession() {
    accessToken.value = null;
    renterId.value = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(RENTER_KEY);
  }

  return {
    accessToken,
    renterId,
    isAuthenticated,
    setSession,
    clearSession,
  };
});
