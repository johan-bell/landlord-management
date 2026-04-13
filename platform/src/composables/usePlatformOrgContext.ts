import { computed } from 'vue';
import { useRoute } from 'vue-router';

export function usePlatformOrgContext() {
    const route = useRoute();
    const orgId = computed(() => route.params.orgId as string);

    function orgApi(path: string) {
        const base = `/organizations/${orgId.value}`;
        if (!path || path === '/') return base;
        return `${base}${path.startsWith('/') ? path : `/${path}`}`;
    }

    return { orgId, orgApi };
}
