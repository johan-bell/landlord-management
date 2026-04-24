<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';
import EmptyState from '../components/EmptyState.vue';
import { useOrgElevatedAccess } from '../composables/useOrgElevatedAccess';

type AuditRow = {
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    actorUserId: string | null;
    metadata: unknown;
    createdAt: string;
};

const { hasOrg, orgApi } = useOrgContext();
const canView = useOrgElevatedAccess();

const rows = ref<AuditRow[]>([]);
const total = ref(0);
const page = ref(1);
const limit = ref(20);
const loading = ref(true);
const error = ref<string | null>(null);

const totalPages = computed(() =>
    total.value === 0 ? 0 : Math.ceil(total.value / limit.value),
);

async function load() {
    if (!hasOrg.value || !canView.value) return;
    loading.value = true;
    error.value = null;
    try {
        const res = await api<{
            items: AuditRow[];
            total: number;
            page: number;
            limit: number;
        }>(`${orgApi('/audit-logs')}?page=${page.value}&limit=${limit.value}`);
        rows.value = res.items;
        total.value = res.total;
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
        rows.value = [];
    } finally {
        loading.value = false;
    }
}

onMounted(() => void load());
watch([hasOrg, page, canView], () => void load());

function fmtMeta(m: unknown): string {
    if (m == null || typeof m !== 'object') return '—';
    try {
        return JSON.stringify(m);
    } catch {
        return '—';
    }
}
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />
        <template v-else-if="!canView">
            <p class="text-sm text-slate-600">
                Only owners and managers can view the audit log.
            </p>
        </template>
        <template v-else>
            <p class="mb-4 text-sm text-slate-600">
                Recent actions on this organization (proofs, payments, team,
                signups, settings).
            </p>
            <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>
            <div
                v-if="loading"
                class="rounded-2xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500"
            >
                Loading…
            </div>
            <div
                v-else
                class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
                <div class="overflow-x-auto">
                    <table
                        class="min-w-200 w-full divide-y divide-slate-200 text-left text-sm"
                    >
                        <thead
                            class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                            <tr>
                                <th class="px-4 py-3">When</th>
                                <th class="px-4 py-3">Action</th>
                                <th class="px-4 py-3">Entity</th>
                                <th class="px-4 py-3">Actor</th>
                                <th class="px-4 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="r in rows"
                                :key="r.id"
                                class="hover:bg-slate-50/80"
                            >
                                <td
                                    class="whitespace-nowrap px-4 py-3 text-xs text-slate-600"
                                >
                                    {{ new Date(r.createdAt).toLocaleString() }}
                                </td>
                                <td
                                    class="px-4 py-3 font-medium text-slate-900"
                                >
                                    {{ r.action }}
                                </td>
                                <td class="px-4 py-3 text-slate-700">
                                    {{ r.entityType }}
                                    <span
                                        v-if="r.entityId"
                                        class="mt-0.5 block font-mono text-xs text-slate-500"
                                        >{{ r.entityId }}</span
                                    >
                                </td>
                                <td
                                    class="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-slate-500"
                                >
                                    {{ r.actorUserId ?? '—' }}
                                </td>
                                <td
                                    class="max-w-xs truncate px-4 py-3 text-xs text-slate-600"
                                    :title="fmtMeta(r.metadata)"
                                >
                                    {{ fmtMeta(r.metadata) }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div v-if="!rows.length" class="px-6 py-10">
                    <EmptyState
                        :icon="ClipboardDocumentListIcon"
                        title="No audit entries yet"
                        description="Actions on payments, team, signups, and settings will appear here."
                    />
                </div>
                <div
                    v-else
                    class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm"
                >
                    <span class="text-slate-500"
                        >Page {{ page }} of {{ totalPages || 1 }} ·
                        {{ total }} entries</span
                    >
                    <div class="flex gap-2">
                        <button
                            type="button"
                            class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                            :disabled="page <= 1"
                            @click="page--"
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                            :disabled="page >= totalPages"
                            @click="page++"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
