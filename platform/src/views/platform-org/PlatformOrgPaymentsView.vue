<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../lib/api';
import PlatformDataPane from '../../components/PlatformDataPane.vue';
import {
    formatDate,
    formatDateTime,
    formatMoney,
} from '../../composables/format';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';
import type { Payment, Property, Renter, Unit } from '../../types/models';

const route = useRoute();
const { orgApi } = usePlatformOrgContext();

type PaymentRow = Payment & {
    lease: {
        id: string;
        renter: Renter;
        unit: Unit & { property: Property };
    };
};

const items = ref<PaymentRow[]>([]);
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const loading = ref(true);
const error = ref<string | null>(null);

const totalPages = computed(() =>
    total.value === 0 ? 0 : Math.ceil(total.value / limit.value),
);

const lastFetchedOrgId = ref<string | null>(null);

async function load() {
    const orgId = route.params.orgId as string;
    if (!orgId) return;
    let requestPage = page.value;
    if (lastFetchedOrgId.value !== orgId) {
        lastFetchedOrgId.value = orgId;
        requestPage = 1;
        if (page.value !== 1) page.value = 1;
    }
    loading.value = true;
    error.value = null;
    try {
        const res = await api<{
            items: PaymentRow[];
            total: number;
            page: number;
            limit: number;
        }>(
            `${orgApi('/payments')}?page=${requestPage}&limit=${limit.value}`,
        );
        items.value = res.items;
        total.value = res.total;
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
        items.value = [];
    } finally {
        loading.value = false;
    }
}

async function markPaid(row: PaymentRow) {
    try {
        await api(
            orgApi(`/leases/${row.lease.id}/payments/${row.id}`),
            {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'PAID',
                    paidAt: new Date().toISOString(),
                    method: 'CASH',
                }),
            },
        );
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Update failed';
    }
}

function statusClass(s: Payment['status']) {
    if (s === 'PAID') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    if (s === 'LATE') return 'bg-red-50 text-red-800 ring-red-200';
    return 'bg-amber-50 text-amber-800 ring-amber-200';
}

watch([() => route.params.orgId, page], () => void load(), { immediate: true });
</script>

<template>
    <div>
        <p class="mb-6 text-sm text-slate-600">
            Rent charges across leases. Mark a row as paid to record collection.
            Data loads per page from the server.
        </p>

        <PlatformDataPane
            :loading="loading"
            :error="error"
            :empty="!loading && !error && items.length === 0"
            empty-message="No payment records."
            @retry="load"
        >
            <div
                class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
                <div class="overflow-x-auto">
                    <table
                        class="min-w-[720px] w-full divide-y divide-slate-200 text-left text-sm"
                    >
                        <thead
                            class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                            <tr>
                                <th class="px-4 py-3">Due</th>
                                <th class="px-4 py-3">Amount</th>
                                <th class="px-4 py-3">Renter</th>
                                <th class="px-4 py-3">Unit</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="px-4 py-3">Paid at</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="row in items"
                                :key="row.id"
                                class="hover:bg-slate-50/80"
                            >
                                <td class="px-4 py-3 text-slate-700">
                                    {{ formatDate(row.dueDate) }}
                                </td>
                                <td
                                    class="px-4 py-3 font-medium tabular-nums text-slate-900"
                                >
                                    {{ formatMoney(row.amount, row.currency) }}
                                </td>
                                <td class="px-4 py-3">
                                    {{ row.lease.renter.fullName }}
                                </td>
                                <td class="px-4 py-3 text-slate-600">
                                    {{ row.lease.unit.label }}
                                    <span class="block text-xs text-slate-400">{{
                                        row.lease.unit.property.name
                                    }}</span>
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                                        :class="statusClass(row.status)"
                                    >
                                        {{ row.status }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-xs text-slate-500">
                                    {{ formatDateTime(row.paidAt) }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        v-if="row.status !== 'PAID'"
                                        type="button"
                                        class="text-sm font-semibold text-indigo-600 hover:underline"
                                        @click="markPaid(row)"
                                    >
                                        Mark paid
                                    </button>
                                    <span v-else class="text-xs text-slate-400"
                                        >—</span
                                    >
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div
                    v-if="items.length"
                    class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm"
                >
                    <span class="text-slate-500"
                        >Page {{ page }} of {{ totalPages || 1 }} ·
                        {{ total }} payments</span
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
        </PlatformDataPane>
    </div>
</template>
