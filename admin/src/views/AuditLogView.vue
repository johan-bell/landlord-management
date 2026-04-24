<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { ClipboardDocumentListIcon, ChevronDownIcon } from '@heroicons/vue/24/outline';
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

const filterAction = ref('');
const filterEntityType = ref('');
const filterFrom = ref('');
const filterTo = ref('');
const expandedId = ref<string | null>(null);

const totalPages = computed(() =>
    total.value === 0 ? 0 : Math.ceil(total.value / limit.value),
);

const distinctActions = computed(() => {
    const s = new Set(rows.value.map((r) => r.action));
    return [...s].sort();
});

const distinctEntityTypes = computed(() => {
    const s = new Set(rows.value.map((r) => r.entityType).filter(Boolean));
    return [...s].sort();
});

const filteredRows = computed(() => {
    return rows.value.filter((r) => {
        if (filterAction.value && r.action !== filterAction.value) return false;
        if (filterEntityType.value && r.entityType !== filterEntityType.value) return false;
        if (filterFrom.value && r.createdAt < filterFrom.value) return false;
        if (filterTo.value && r.createdAt > filterTo.value + 'T23:59:59') return false;
        return true;
    });
});

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

function clearFilters() {
    filterAction.value = '';
    filterEntityType.value = '';
    filterFrom.value = '';
    filterTo.value = '';
}

function toggleExpand(id: string) {
    expandedId.value = expandedId.value === id ? null : id;
}

function fmtMeta(m: unknown): string {
    if (m == null || typeof m !== 'object') return '—';
    try {
        return JSON.stringify(m, null, 2);
    } catch {
        return '—';
    }
}

function fmtMetaShort(m: unknown): string {
    if (m == null || typeof m !== 'object') return '—';
    try {
        const s = JSON.stringify(m);
        return s.length > 60 ? s.slice(0, 60) + '…' : s;
    } catch {
        return '—';
    }
}

function actionColor(action: string) {
    if (action.startsWith('CREATE') || action.includes('CREATED') || action.includes('APPROVED')) return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    if (action.startsWith('DELETE') || action.includes('DELETED') || action.includes('REJECTED') || action.includes('SUSPEND')) return 'bg-red-50 text-red-800 ring-red-200';
    if (action.includes('UPDATE') || action.includes('PATCH') || action.includes('CHANGE')) return 'bg-blue-50 text-blue-800 ring-blue-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
}

const activeFilters = computed(
    () => [filterAction.value, filterEntityType.value, filterFrom.value, filterTo.value].filter(Boolean).length,
);

onMounted(() => void load());
watch([hasOrg, page, canView], () => void load());
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

            <!-- Filters -->
            <div class="mb-4 flex flex-wrap items-end gap-3">
                <label class="flex flex-col gap-1 text-xs font-medium text-slate-700">
                    Action
                    <select
                        v-model="filterAction"
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    >
                        <option value="">All actions</option>
                        <option v-for="a in distinctActions" :key="a" :value="a">{{ a }}</option>
                    </select>
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-slate-700">
                    Entity type
                    <select
                        v-model="filterEntityType"
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    >
                        <option value="">All entities</option>
                        <option v-for="e in distinctEntityTypes" :key="e" :value="e">{{ e }}</option>
                    </select>
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-slate-700">
                    From
                    <input
                        v-model="filterFrom"
                        type="date"
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                </label>
                <label class="flex flex-col gap-1 text-xs font-medium text-slate-700">
                    To
                    <input
                        v-model="filterTo"
                        type="date"
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                    />
                </label>
                <button
                    v-if="activeFilters > 0"
                    type="button"
                    class="self-end rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    @click="clearFilters"
                >
                    Clear ({{ activeFilters }})
                </button>
            </div>

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
                                <th class="w-8 px-4 py-3" />
                                <th class="px-4 py-3">When</th>
                                <th class="px-4 py-3">Action</th>
                                <th class="px-4 py-3">Entity</th>
                                <th class="px-4 py-3">Actor</th>
                                <th class="px-4 py-3">Details</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <template v-for="r in filteredRows" :key="r.id">
                                <tr
                                    class="cursor-pointer hover:bg-slate-50/80"
                                    :class="expandedId === r.id ? 'bg-slate-50' : ''"
                                    @click="toggleExpand(r.id)"
                                >
                                    <td class="px-4 py-3 text-slate-400">
                                        <ChevronDownIcon
                                            class="h-3.5 w-3.5 transition-transform"
                                            :class="expandedId === r.id ? 'rotate-180' : ''"
                                        />
                                    </td>
                                    <td class="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                                        {{ new Date(r.createdAt).toLocaleString() }}
                                    </td>
                                    <td class="px-4 py-3">
                                        <span
                                            class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                                            :class="actionColor(r.action)"
                                        >
                                            {{ r.action }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-slate-700">
                                        {{ r.entityType }}
                                        <span
                                            v-if="r.entityId"
                                            class="mt-0.5 block font-mono text-xs text-slate-500"
                                        >{{ r.entityId }}</span>
                                    </td>
                                    <td class="max-w-30 truncate px-4 py-3 font-mono text-xs text-slate-500">
                                        {{ r.actorUserId ?? '—' }}
                                    </td>
                                    <td class="max-w-xs truncate px-4 py-3 text-xs text-slate-600">
                                        {{ fmtMetaShort(r.metadata) }}
                                    </td>
                                </tr>
                                <tr v-if="expandedId === r.id" class="bg-slate-50">
                                    <td colspan="6" class="px-6 pb-4 pt-0">
                                        <pre class="overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-200 leading-relaxed">{{ fmtMeta(r.metadata) }}</pre>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
                <div v-if="!filteredRows.length" class="px-6 py-10">
                    <EmptyState
                        :icon="ClipboardDocumentListIcon"
                        :title="activeFilters > 0 ? 'No entries match your filters' : 'No audit entries yet'"
                        :description="activeFilters > 0 ? 'Try adjusting or clearing the filters above.' : 'Actions on payments, team, signups, and settings will appear here.'"
                    />
                </div>
                <div
                    v-else
                    class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm"
                >
                    <span class="text-slate-500">
                        Page {{ page }} of {{ totalPages || 1 }} · {{ total }} entries
                        <template v-if="activeFilters > 0"> · {{ filteredRows.length }} shown</template>
                    </span>
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
