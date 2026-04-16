<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgElevatedAccess } from '../composables/useOrgElevatedAccess';
import { useOrgContext } from '../composables/useOrgContext';
import { formatDate, formatDateTime, formatMoney } from '../composables/format';
import type { LeaseUtilityBill, Payment } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();
const canVerify = useOrgElevatedAccess();

type PendingPayment = Payment & {
    lease: {
        id: string;
        renter: { fullName: string };
        unit: { label: string; property: { name: string } };
        currency: string;
    };
};

type PendingUtility = LeaseUtilityBill & {
    lease: {
        id: string;
        renter: { fullName: string };
        unit: { label: string; property: { name: string } };
        currency: string;
    };
};

const loading = ref(true);
const error = ref<string | null>(null);
const payments = ref<PendingPayment[]>([]);
const utilityBills = ref<PendingUtility[]>([]);
const busyId = ref<string | null>(null);

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        const res = await api<{
            payments: PendingPayment[];
            utilityBills: PendingUtility[];
        }>(orgApi('/proofs/pending'));
        payments.value = res.payments;
        utilityBills.value = res.utilityBills;
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
    } finally {
        loading.value = false;
    }
}

async function viewReceipt(objectKey: string) {
    if (!hasOrg.value) return;
    const q = new URLSearchParams({ key: objectKey });
    const res = await api<{ viewUrl: string }>(
        orgApi(`/proofs/view?${q.toString()}`),
    );
    window.open(res.viewUrl, '_blank', 'noopener,noreferrer');
}

async function approveRent(p: PendingPayment) {
    busyId.value = p.id;
    error.value = null;
    try {
        await api(orgApi(`/proofs/payments/${p.id}/approve`), { method: 'POST' });
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Approve failed';
    } finally {
        busyId.value = null;
    }
}

async function rejectRent(p: PendingPayment) {
    const note = window.prompt('Optional note to the tenant (shown in the portal):');
    if (note === null) return;
    busyId.value = p.id;
    error.value = null;
    try {
        await api(orgApi(`/proofs/payments/${p.id}/reject`), {
            method: 'POST',
            body: JSON.stringify({ note: note.trim() || undefined }),
        });
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Reject failed';
    } finally {
        busyId.value = null;
    }
}

async function approveUtility(b: PendingUtility) {
    busyId.value = b.id;
    error.value = null;
    try {
        await api(orgApi(`/proofs/utility-bills/${b.id}/approve`), {
            method: 'POST',
        });
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Approve failed';
    } finally {
        busyId.value = null;
    }
}

async function rejectUtility(b: PendingUtility) {
    const note = window.prompt('Optional note to the tenant (shown in the portal):');
    if (note === null) return;
    busyId.value = b.id;
    error.value = null;
    try {
        await api(orgApi(`/proofs/utility-bills/${b.id}/reject`), {
            method: 'POST',
            body: JSON.stringify({ note: note.trim() || undefined }),
        });
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Reject failed';
    } finally {
        busyId.value = null;
    }
}

function utilityPeriod(b: PendingUtility) {
    return new Date(b.year, b.month - 1, 1).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
    });
}

onMounted(() => void load());
watch(hasOrg, () => void load());
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <p class="mb-6 text-sm text-slate-600">
                Rent and metered utility payments stay
                <strong class="font-semibold text-slate-800">pending</strong> on
                the tenant portal until someone with the right role opens the
                receipt and approves or rejects it.
                <template v-if="canVerify">
                    You can also mark items paid from the Payments or Leases
                    screens when you collect cash in person without a photo.
                </template>
                <template v-else>
                    <span class="font-medium text-slate-800">
                        Only owners and managers
                    </span>
                    can approve, reject, or mark charges paid without a receipt.
                </template>
            </p>

            <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

            <div
                v-if="loading"
                class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
            >
                Loading…
            </div>

            <div v-else class="space-y-8">
                <section
                    class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <h2
                        class="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                    >
                        Rent receipts awaiting verification ({{
                            payments.length
                        }})
                    </h2>
                    <div v-if="!payments.length" class="px-4 py-8 text-center text-sm text-slate-500">
                        None right now.
                    </div>
                    <ul v-else class="divide-y divide-slate-100">
                        <li
                            v-for="p in payments"
                            :key="p.id"
                            class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div class="min-w-0 text-sm">
                                <p class="font-medium text-slate-900">
                                    {{ formatMoney(p.amount, p.currency) }} · due
                                    {{ formatDate(p.dueDate) }}
                                </p>
                                <p class="text-slate-600">
                                    {{ p.lease.renter.fullName }} ·
                                    {{ p.lease.unit.property.name }} ·
                                    {{ p.lease.unit.label }}
                                </p>
                                <p class="text-xs text-slate-500">
                                    Submitted
                                    {{ formatDateTime(p.proofSubmittedAt) }}
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <button
                                    v-if="p.proofObjectKey"
                                    type="button"
                                    class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    @click="viewReceipt(p.proofObjectKey!)"
                                >
                                    View receipt
                                </button>
                                <button
                                    v-if="canVerify"
                                    type="button"
                                    class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    :disabled="busyId === p.id"
                                    @click="approveRent(p)"
                                >
                                    Approve
                                </button>
                                <button
                                    v-if="canVerify"
                                    type="button"
                                    class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    :disabled="busyId === p.id"
                                    @click="rejectRent(p)"
                                >
                                    Reject
                                </button>
                            </div>
                        </li>
                    </ul>
                </section>

                <section
                    class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <h2
                        class="border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                    >
                        Utility receipts awaiting verification ({{
                            utilityBills.length
                        }})
                    </h2>
                    <div
                        v-if="!utilityBills.length"
                        class="px-4 py-8 text-center text-sm text-slate-500"
                    >
                        None right now.
                    </div>
                    <ul v-else class="divide-y divide-slate-100">
                        <li
                            v-for="b in utilityBills"
                            :key="b.id"
                            class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div class="min-w-0 text-sm">
                                <p class="font-medium text-slate-900">
                                    {{ utilityPeriod(b) }} ·
                                    {{
                                        b.kind === 'ELECTRICITY'
                                            ? 'Electricity'
                                            : 'Water'
                                    }}
                                    ·
                                    {{ formatMoney(b.amount, b.currency) }}
                                </p>
                                <p class="text-slate-600">
                                    {{ b.lease.renter.fullName }} ·
                                    {{ b.lease.unit.property.name }} ·
                                    {{ b.lease.unit.label }}
                                </p>
                                <p class="text-xs text-slate-500">
                                    Submitted
                                    {{ formatDateTime(b.proofSubmittedAt) }}
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <button
                                    v-if="b.proofObjectKey"
                                    type="button"
                                    class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    @click="viewReceipt(b.proofObjectKey!)"
                                >
                                    View receipt
                                </button>
                                <button
                                    v-if="canVerify"
                                    type="button"
                                    class="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                    :disabled="busyId === b.id"
                                    @click="approveUtility(b)"
                                >
                                    Approve
                                </button>
                                <button
                                    v-if="canVerify"
                                    type="button"
                                    class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                                    :disabled="busyId === b.id"
                                    @click="rejectUtility(b)"
                                >
                                    Reject
                                </button>
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </template>
    </div>
</template>
