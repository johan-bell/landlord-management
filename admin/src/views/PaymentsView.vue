<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { WalletIcon } from '@heroicons/vue/24/outline';
import { api } from '../lib/api';
import { useOrgElevatedAccess } from '../composables/useOrgElevatedAccess';
import { useOrgContext } from '../composables/useOrgContext';
import { formatDate, formatDateTime, formatMoney } from '../composables/format';
import type { Lease, Payment, Property, Renter, Unit } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';
import EmptyState from '../components/EmptyState.vue';
import { useToastStore } from '../stores/toast';

type SummaryStats = {
    totalDue: number;
    totalPaid: number;
    overdueCount: number;
    pendingCount: number;
    currency: string;
};

const summaryStats = ref<SummaryStats | null>(null);

const toast = useToastStore();
const { hasOrg, orgApi } = useOrgContext();
const canMarkPaid = useOrgElevatedAccess();

type PaymentWithLease = Payment & {
    lease: Lease & {
        renter: Renter;
        unit: Unit & { property: Property };
    };
};

type Row = Payment & {
    renterName: string;
    unitLabel: string;
    propertyName: string;
};

const loading = ref(true);
const error = ref<string | null>(null);
const renterFilter = ref('');
const statusFilter = ref<string>('');
const page = ref(1);
const limit = ref(25);
const total = ref(0);
const rawItems = ref<PaymentWithLease[]>([]);
const selectedIds = ref<Set<string>>(new Set());
const bulkBusy = ref(false);

const rows = computed<Row[]>(() =>
    rawItems.value.map((p) => ({
        ...p,
        renterName: p.lease.renter.fullName,
        unitLabel: p.lease.unit.label,
        propertyName: p.lease.unit.property.name,
    })),
);

const filteredRows = computed(() => {
    const q = renterFilter.value.trim().toLowerCase();
    if (!q) return rows.value;
    return rows.value.filter((r) =>
        `${r.renterName} ${r.unitLabel} ${r.propertyName}`
            .toLowerCase()
            .includes(q),
    );
});

const totalPages = computed(() =>
    total.value === 0 ? 0 : Math.ceil(total.value / limit.value),
);

const pageInfo = computed(() => {
    if (total.value === 0) return null;
    const start = (page.value - 1) * limit.value + 1;
    const end = Math.min(page.value * limit.value, total.value);
    return `Showing ${start}–${end} of ${total.value}`;
});

const markableRows = computed(() =>
    filteredRows.value.filter(
        (r) =>
            r.status !== 'PAID' &&
            r.proofVerification !== 'PENDING_VERIFICATION',
    ),
);

const allSelected = computed(
    () =>
        markableRows.value.length > 0 &&
        markableRows.value.every((r) => selectedIds.value.has(r.id)),
);

function toggleRow(id: string) {
    const s = new Set(selectedIds.value);
    if (s.has(id)) {
        s.delete(id);
    } else {
        s.add(id);
    }
    selectedIds.value = s;
}

function toggleAll() {
    if (allSelected.value) {
        selectedIds.value = new Set();
    } else {
        selectedIds.value = new Set(markableRows.value.map((r) => r.id));
    }
}

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    selectedIds.value = new Set();
    try {
        const params = new URLSearchParams({
            page: String(page.value),
            limit: String(limit.value),
        });
        const s = renterFilter.value.trim();
        if (s.length >= 2) params.set('search', s);
        if (statusFilter.value) params.set('status', statusFilter.value);
        const res = await api<{
            items: PaymentWithLease[];
            total: number;
            page: number;
            limit: number;
        }>(`${orgApi('/payments')}?${params.toString()}`);
        rawItems.value = res.items;
        total.value = res.total;
        computeSummary(res.items);
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
        rawItems.value = [];
    } finally {
        loading.value = false;
    }
}

function computeSummary(items: PaymentWithLease[]) {
    if (!items.length) { summaryStats.value = null; return; }
    const currency = items[0]?.currency ?? 'XAF';
    let totalDue = 0, totalPaid = 0, overdueCount = 0, pendingCount = 0;
    for (const p of items) {
        totalDue += Number(p.amount);
        if (p.status === 'PAID') totalPaid += Number(p.amount);
        if (p.status === 'LATE') overdueCount++;
        if (p.status === 'PENDING') pendingCount++;
    }
    summaryStats.value = { totalDue, totalPaid, overdueCount, pendingCount, currency };
}

function proofLabel(p: Payment) {
    const v = p.proofVerification ?? 'NONE';
    if (v === 'PENDING_VERIFICATION') return 'Receipt pending review';
    if (v === 'REJECTED') return 'Receipt rejected';
    if (v === 'APPROVED') return 'Verified';
    return '—';
}

function statusClass(s: Payment['status']) {
    if (s === 'PAID') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    if (s === 'LATE') return 'bg-red-50 text-red-800 ring-red-200';
    if (s === 'CANCELLED') return 'bg-slate-100 text-slate-600 ring-slate-200';
    return 'bg-amber-50 text-amber-800 ring-amber-200';
}

function statusLabel(s: Payment['status']) {
    if (s === 'PAID') return 'Paid';
    if (s === 'LATE') return 'Late';
    if (s === 'CANCELLED') return 'Cancelled';
    return 'Due';
}

async function markPaid(row: Row) {
    try {
        await api(orgApi(`/leases/${row.leaseId}/payments/${row.id}`), {
            method: 'PATCH',
            body: JSON.stringify({
                status: 'PAID',
                paidAt: new Date().toISOString(),
                method: 'CASH',
            }),
        });
        toast.success('Payment marked as paid');
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed');
    }
}

async function bulkMarkPaid() {
    const ids = [...selectedIds.value];
    if (!ids.length || bulkBusy.value) return;
    bulkBusy.value = true;
    const paidAt = new Date().toISOString();
    let succeeded = 0;
    let failed = 0;
    for (const row of filteredRows.value.filter((r) => ids.includes(r.id))) {
        try {
            await api(orgApi(`/leases/${row.leaseId}/payments/${row.id}`), {
                method: 'PATCH',
                body: JSON.stringify({
                    status: 'PAID',
                    paidAt,
                    method: 'CASH',
                }),
            });
            succeeded++;
        } catch {
            failed++;
        }
    }
    bulkBusy.value = false;
    if (succeeded)
        toast.success(
            `${succeeded} payment${succeeded > 1 ? 's' : ''} marked as paid`,
        );
    if (failed)
        toast.error(
            `${failed} payment${failed > 1 ? 's' : ''} could not be updated`,
        );
    await load();
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSearchReload() {
    if (searchTimer) clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        page.value = 1;
        void load();
    }, 350);
}

onMounted(() => void load());
watch(hasOrg, () => void load());
watch([page, statusFilter], () => void load());
watch(renterFilter, () => scheduleSearchReload());
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <div
                class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            >
                <p class="text-sm text-slate-600">
                    Rent charges across all leases.
                    <template v-if="canMarkPaid">
                        Use
                        <strong class="font-medium text-slate-800"
                            >Mark paid</strong
                        >
                        for cash collected in person, or select multiple rows to
                        bulk-pay.
                    </template>
                    <template v-else>
                        Only
                        <strong class="font-medium text-slate-800"
                            >owners and managers</strong
                        >
                        can record payments without receipt verification.
                    </template>
                </p>
            </div>

            <!-- Summary stats bar -->
            <div
                v-if="summaryStats"
                class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4"
            >
                <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Total due</p>
                    <p class="mt-1 text-lg font-bold tabular-nums text-slate-900">
                        {{ formatMoney(summaryStats.totalDue, summaryStats.currency) }}
                    </p>
                </div>
                <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Collected</p>
                    <p class="mt-1 text-lg font-bold tabular-nums text-emerald-700">
                        {{ formatMoney(summaryStats.totalPaid, summaryStats.currency) }}
                    </p>
                </div>
                <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Overdue</p>
                    <p class="mt-1 text-lg font-bold tabular-nums" :class="summaryStats.overdueCount > 0 ? 'text-red-700' : 'text-slate-400'">
                        {{ summaryStats.overdueCount }}
                    </p>
                </div>
                <div class="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">Pending</p>
                    <p class="mt-1 text-lg font-bold tabular-nums" :class="summaryStats.pendingCount > 0 ? 'text-amber-700' : 'text-slate-400'">
                        {{ summaryStats.pendingCount }}
                    </p>
                </div>
            </div>

            <p
                v-if="error"
                class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
                {{ error }}
            </p>

            <div class="mb-4 flex flex-wrap items-center gap-3">
                <label
                    class="flex min-w-50 flex-1 items-center gap-2 text-sm text-slate-600"
                >
                    <span class="shrink-0 font-medium text-slate-700"
                        >Search</span
                    >
                    <input
                        v-model="renterFilter"
                        type="search"
                        placeholder="Renter, unit or property…"
                        class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                </label>
                <label class="flex items-center gap-2 text-sm text-slate-600">
                    <span class="font-medium text-slate-700">Status</span>
                    <select
                        v-model="statusFilter"
                        class="rounded-xl border border-slate-200 px-2 py-2 text-sm"
                    >
                        <option value="">All</option>
                        <option value="PENDING">Due</option>
                        <option value="PAID">Paid</option>
                        <option value="LATE">Late</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </label>
                <span v-if="pageInfo" class="text-xs text-slate-500">{{
                    pageInfo
                }}</span>
            </div>

            <Transition
                enter-active-class="transition duration-150 ease-out"
                enter-from-class="opacity-0 -translate-y-1"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition duration-100 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div
                    v-if="canMarkPaid && selectedIds.size > 0"
                    class="mb-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5"
                >
                    <span class="text-sm font-medium text-emerald-900">
                        {{ selectedIds.size }} selected
                    </span>
                    <button
                        type="button"
                        class="rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        :disabled="bulkBusy"
                        @click="bulkMarkPaid"
                    >
                        {{ bulkBusy ? 'Saving…' : 'Mark all paid (cash)' }}
                    </button>
                </div>
            </Transition>

            <div
                v-if="loading"
                class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
            >
                Loading…
            </div>

            <template v-else>
                <EmptyState
                    v-if="!rows.length"
                    :icon="WalletIcon"
                    title="No payment records yet"
                    description="Payment charges appear here once leases have a due date set."
                />

                <div
                    v-else
                    class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <div class="overflow-x-auto">
                        <table
                            class="min-w-180 w-full divide-y divide-slate-200 text-left text-sm"
                        >
                            <thead
                                class="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                            >
                                <tr>
                                    <th
                                        v-if="canMarkPaid"
                                        class="px-4 py-3 w-10"
                                    >
                                        <input
                                            type="checkbox"
                                            class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            :checked="allSelected"
                                            :disabled="
                                                markableRows.length === 0
                                            "
                                            @change="toggleAll"
                                        />
                                    </th>
                                    <th class="px-4 py-3">Due</th>
                                    <th class="px-4 py-3">Amount</th>
                                    <th class="px-4 py-3">Renter</th>
                                    <th class="px-4 py-3">Unit</th>
                                    <th class="px-4 py-3">Status</th>
                                    <th class="px-4 py-3">Receipt</th>
                                    <th class="px-4 py-3">Paid at</th>
                                    <th class="px-4 py-3 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                <tr
                                    v-for="row in filteredRows"
                                    :key="row.id"
                                    class="hover:bg-slate-50/80"
                                    :class="
                                        selectedIds.has(row.id)
                                            ? 'bg-emerald-50/40'
                                            : ''
                                    "
                                >
                                    <td v-if="canMarkPaid" class="px-4 py-3">
                                        <input
                                            v-if="
                                                row.status !== 'PAID' &&
                                                row.proofVerification !==
                                                    'PENDING_VERIFICATION'
                                            "
                                            type="checkbox"
                                            class="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                            :checked="selectedIds.has(row.id)"
                                            @change="toggleRow(row.id)"
                                        />
                                    </td>
                                    <td class="px-4 py-3 text-slate-700">
                                        {{ formatDate(row.dueDate) }}
                                    </td>
                                    <td
                                        class="px-4 py-3 font-medium tabular-nums text-slate-900"
                                    >
                                        {{
                                            formatMoney(
                                                row.amount,
                                                row.currency,
                                            )
                                        }}
                                    </td>
                                    <td class="px-4 py-3">
                                        {{ row.renterName }}
                                    </td>
                                    <td class="px-4 py-3 text-slate-600">
                                        {{ row.unitLabel }}
                                        <span
                                            class="block text-xs text-slate-400"
                                            >{{ row.propertyName }}</span
                                        >
                                    </td>
                                    <td class="px-4 py-3">
                                        <span
                                            class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                                            :class="statusClass(row.status)"
                                        >
                                            {{ statusLabel(row.status) }}
                                        </span>
                                    </td>
                                    <td
                                        class="max-w-40 px-4 py-3 text-xs text-slate-600"
                                    >
                                        {{ proofLabel(row) }}
                                        <span
                                            v-if="
                                                row.proofVerification ===
                                                    'REJECTED' &&
                                                row.proofRejectionNote
                                            "
                                            class="mt-0.5 block text-slate-500"
                                            >{{ row.proofRejectionNote }}</span
                                        >
                                    </td>
                                    <td
                                        class="px-4 py-3 text-xs text-slate-500"
                                    >
                                        {{ formatDateTime(row.paidAt) }}
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <button
                                            v-if="
                                                canMarkPaid &&
                                                row.status !== 'PAID' &&
                                                row.proofVerification !==
                                                    'PENDING_VERIFICATION'
                                            "
                                            type="button"
                                            class="text-sm font-semibold text-emerald-600 hover:underline"
                                            @click="markPaid(row)"
                                        >
                                            Mark paid
                                        </button>
                                        <span
                                            v-else-if="
                                                row.proofVerification ===
                                                'PENDING_VERIFICATION'
                                            "
                                            class="text-xs text-amber-800"
                                            >Use Receipts</span
                                        >
                                        <span
                                            v-else
                                            class="text-xs text-slate-400"
                                            >—</span
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div
                        v-if="rows.length && !filteredRows.length"
                        class="px-4 py-10 text-center text-sm text-slate-500"
                    >
                        No rows match your filter.
                    </div>

                    <div
                        v-if="totalPages > 1"
                        class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm"
                    >
                        <span class="text-slate-500">{{ pageInfo }}</span>
                        <div class="flex gap-2">
                            <button
                                type="button"
                                class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                                :disabled="page <= 1"
                                @click="
                                    page--;
                                    void load();
                                "
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-40"
                                :disabled="page >= totalPages"
                                @click="
                                    page++;
                                    void load();
                                "
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </template>
        </template>
    </div>
</template>
