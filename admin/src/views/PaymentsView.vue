<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgElevatedAccess } from '../composables/useOrgElevatedAccess';
import { useOrgContext } from '../composables/useOrgContext';
import { formatDate, formatDateTime, formatMoney } from '../composables/format';
import type { Lease, Paginated, Payment } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();
const canMarkPaid = useOrgElevatedAccess();

const leases = ref<Lease[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const renterFilter = ref('');

type Row = Payment & {
    renterName: string;
    unitLabel: string;
    propertyName: string;
};

const rows = computed<Row[]>(() => {
    const out: Row[] = [];
    for (const lease of leases.value) {
        for (const p of lease.payments ?? []) {
            out.push({
                ...p,
                renterName: lease.renter.fullName,
                unitLabel: lease.unit.label,
                propertyName: lease.unit.property.name,
            });
        }
    }
    return out.sort(
        (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    );
});

const filteredRows = computed(() => {
    const q = renterFilter.value.trim().toLowerCase();
    if (!q) return rows.value;
    return rows.value.filter((r) => {
        const blob = `${r.renterName} ${r.unitLabel} ${r.propertyName}`.toLowerCase();
        return blob.includes(q);
    });
});

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        const res = await api<Paginated<Lease>>(orgApi('/leases?limit=500'));
        leases.value = res.items as Lease[];
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
    } finally {
        loading.value = false;
    }
}

function proofLabel(p: Payment) {
    const v = p.proofVerification ?? 'NONE';
    if (v === 'PENDING_VERIFICATION') return 'Receipt pending review';
    if (v === 'REJECTED') return 'Receipt rejected';
    if (v === 'APPROVED') return 'Verified';
    return '—';
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

onMounted(() => void load());
watch(hasOrg, () => void load());
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <p class="mb-6 text-sm text-slate-600">
                Rent charges across all leases. Tenants can upload a receipt; use
                <strong class="font-medium text-slate-800">Receipts</strong> to
                verify.
                <template v-if="canMarkPaid">
                    Use
                    <strong class="font-medium text-slate-800">Mark paid</strong>
                    for cash collected in person (skips photo verification).
                </template>
                <template v-else>
                    Only
                    <strong class="font-medium text-slate-800"
                        >owners and managers</strong
                    >
                    can mark rent paid without going through receipt verification.
                </template>
            </p>

            <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

            <div
                v-if="!loading && rows.length"
                class="mb-4 flex flex-wrap items-center gap-3"
            >
                <label class="flex min-w-[200px] flex-1 items-center gap-2 text-sm text-slate-600">
                    <span class="shrink-0 font-medium text-slate-700"
                        >Filter</span
                    >
                    <input
                        v-model="renterFilter"
                        type="search"
                        placeholder="Renter, unit, or property…"
                        class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
                    />
                </label>
                <span class="text-xs text-slate-500"
                    >{{ filteredRows.length }} of {{ rows.length }} rows</span
                >
            </div>

            <div
                v-if="loading"
                class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
            >
                Loading…
            </div>

            <div
                v-else
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
                                <th class="px-4 py-3">Receipt</th>
                                <th class="px-4 py-3">Paid at</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="row in filteredRows"
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
                                <td class="px-4 py-3">{{ row.renterName }}</td>
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
                                        {{ row.status }}
                                    </span>
                                </td>
                                <td
                                    class="max-w-[10rem] px-4 py-3 text-xs text-slate-600"
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
                                <td class="px-4 py-3 text-xs text-slate-500">
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
                                    </button>
                                    <span
                                        v-else-if="
                                            row.proofVerification ===
                                            'PENDING_VERIFICATION'
                                        "
                                        class="text-xs text-amber-800"
                                        >Use Receipts</span
                                    >
                                    <span v-else class="text-xs text-slate-400"
                                        >—</span
                                    >
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p
                    v-if="!loading && rows.length && !filteredRows.length"
                    class="px-4 py-10 text-center text-sm text-slate-500"
                >
                    No rows match your filter.
                </p>
                <p
                    v-else-if="!rows.length"
                    class="px-4 py-10 text-center text-sm text-slate-500"
                >
                    No payment records. Add payments via the API or extend this
                    screen with a “Record payment” flow.
                </p>
            </div>
        </template>
    </div>
</template>
