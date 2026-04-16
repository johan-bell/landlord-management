import { computed, type ComputedRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useOrgStore } from '../stores/org';

/**
 * Owner, Manager, or platform operator — team management, approvals, billing,
 * org settings, marking charges paid, etc.
 */
export function useOrgElevatedAccess(): ComputedRef<boolean> {
    const auth = useAuthStore();
    const orgStore = useOrgStore();
    const { selectedOrgMyRole } = storeToRefs(orgStore);
    return computed(() => {
        if (auth.user?.isPlatformAdmin) return true;
        const r = selectedOrgMyRole.value;
        return r === 'OWNER' || r === 'MANAGER';
    });
}
