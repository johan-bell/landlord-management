import { computed, ref } from 'vue';
import type { Ref } from 'vue';

type FetchFn<T> = (
    page: number,
    limit: number,
) => Promise<{ items: T[]; total: number; page: number; limit: number }>;

export function usePaginatedList<T>(fetchFn: FetchFn<T>, defaultLimit = 20) {
    const items = ref<T[]>([]) as Ref<T[]>;
    const total = ref(0);
    const page = ref(1);
    const limit = ref(defaultLimit);
    const loading = ref(false);
    const error = ref<string | null>(null);

    const totalPages = computed(() =>
        limit.value > 0 ? Math.ceil(total.value / limit.value) : 0,
    );

    const pageInfo = computed(() => {
        if (total.value === 0) return 'No results';
        const start = (page.value - 1) * limit.value + 1;
        const end = Math.min(page.value * limit.value, total.value);
        return `Showing ${start}–${end} of ${total.value}`;
    });

    async function load() {
        loading.value = true;
        error.value = null;
        try {
            const res = await fetchFn(page.value, limit.value);
            items.value = res.items;
            total.value = res.total;
        } catch (e) {
            error.value = e instanceof Error ? e.message : 'Failed to load';
            items.value = [];
        } finally {
            loading.value = false;
        }
    }

    function goTo(p: number) {
        page.value = Math.max(1, Math.min(p, totalPages.value || 1));
        return load();
    }

    function next() {
        if (page.value < (totalPages.value || 1)) {
            page.value++;
            return load();
        }
    }

    function prev() {
        if (page.value > 1) {
            page.value--;
            return load();
        }
    }

    function reset() {
        page.value = 1;
        return load();
    }

    return {
        items,
        total,
        page,
        limit,
        loading,
        error,
        totalPages,
        pageInfo,
        load,
        goTo,
        next,
        prev,
        reset,
    };
}
