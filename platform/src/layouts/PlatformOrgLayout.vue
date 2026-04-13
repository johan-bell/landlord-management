<script setup lang="ts">
import { provide, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { api } from '../lib/api';
import PlatformOrgNav from '../components/PlatformOrgNav.vue';

const route = useRoute();
const orgName = ref<string | null>(null);
const loading = ref(true);

async function loadOrgTitle() {
    const id = route.params.orgId as string;
    if (!id) return;
    loading.value = true;
    try {
        const o = await api<{ name: string }>(`/platform/organizations/${id}`);
        orgName.value = o.name;
    } catch {
        orgName.value = null;
    } finally {
        loading.value = false;
    }
}

provide('reloadOrgTitle', loadOrgTitle);

watch(
    () => route.params.orgId,
    () => void loadOrgTitle(),
    { immediate: true },
);
</script>

<template>
    <div>
        <div
            class="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
        >
            <div>
                <RouterLink
                    class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    to="/"
                >
                    ← All organizations
                </RouterLink>
                <h1
                    class="mt-2 text-2xl font-bold tracking-tight text-slate-900"
                >
                    <span v-if="loading" class="text-slate-400">Loading…</span>
                    <span v-else>{{ orgName ?? 'Organization' }}</span>
                </h1>
            </div>
        </div>

        <PlatformOrgNav />
        <RouterView />
    </div>
</template>
