import { storeToRefs } from 'pinia';
import { computed } from 'vue';
import { useOrgStore } from '../stores/org';

export function useOrgContext() {
  const orgStore = useOrgStore();
  const { selectedOrgId } = storeToRefs(orgStore);

  const hasOrg = computed(() => Boolean(selectedOrgId.value));

  function orgApi(path: string): string {
    const id = selectedOrgId.value;
    if (!id) throw new Error('No organization selected');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `/organizations/${id}${p}`;
  }

  return {
    selectedOrgId,
    hasOrg,
    orgApi,
    setOrg: orgStore.setOrg,
    loadOrgFromStorage: orgStore.loadFromStorage,
  };
}
