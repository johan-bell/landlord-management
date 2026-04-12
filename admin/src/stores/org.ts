import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../lib/api';
import type { Organization } from '../types/models';

export const useOrgStore = defineStore('org', () => {
  const selectedOrgId = ref<string | null>(null);
  const organizations = ref<Organization[]>([]);
  const organizationsLoading = ref(false);

  function setOrg(id: string | null) {
    selectedOrgId.value = id;
    if (id) {
      localStorage.setItem('lm_org_id', id);
    } else {
      localStorage.removeItem('lm_org_id');
    }
  }

  function loadFromStorage() {
    const id = localStorage.getItem('lm_org_id');
    if (id) selectedOrgId.value = id;
  }

  async function fetchOrganizations() {
    organizationsLoading.value = true;
    try {
      organizations.value = await api<Organization[]>('/organizations');
      loadFromStorage();
      if (
        selectedOrgId.value &&
        !organizations.value.some((o) => o.id === selectedOrgId.value)
      ) {
        setOrg(null);
      }
    } finally {
      organizationsLoading.value = false;
    }
  }

  return {
    selectedOrgId,
    organizations,
    organizationsLoading,
    setOrg,
    loadFromStorage,
    fetchOrganizations,
  };
});
