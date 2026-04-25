<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgElevatedAccess } from '../composables/useOrgElevatedAccess';
import { useOrgContext } from '../composables/useOrgContext';
import { formatDate, formatDateTime, formatMoney } from '../composables/format';
import type { LeaseUtilityBill, Payment } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';
import { useToastStore } from '../stores/toast';

const { hasOrg, orgApi } = useOrgContext();
const canVerify = useOrgElevatedAccess();
const toast = useToastStore();

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

const rejectModal = ref<{
    open: boolean;
    kind: 'payment' | 'utility';
    item: PendingPayment | PendingUtility | null;
    note: string;
}>({ open: false, kind: 'payment', item: null, note: '' });

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
        await api(orgApi(`/proofs/payments/${p.id}/approve`), {
            method: 'POST',
        });
        toast.success('Receipt approved');
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally {
        busyId.value = null;
    }
}

function openRejectPayment(p: PendingPayment) {
    rejectModal.value = { open: true, kind: 'payment', item: p, note: '' };
}

async function approveUtility(b: PendingUtility) {
    busyId.value = b.id;
    error.value = null;
    try {
        await api(orgApi(`/proofs/utility-bills/${b.id}/approve`), {
            method: 'POST',
        });
        toast.success('Receipt approved');
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Approve failed');
    } finally {
        busyId.value = null;
    }
}

function openRejectUtility(b: PendingUtility) {
    rejectModal.value = { open: true, kind: 'utility', item: b, note: '' };
}

async function submitReject() {
    const { item, kind, note } = rejectModal.value;
    if (!item) return;
    busyId.value = item.id;
    try {
        const body = JSON.stringify({ note: note.trim() || undefined });
        if (kind === 'payment') {
            await api(orgApi(`/proofs/payments/${item.id}/reject`), {
                method: 'POST',
                body,
            });
        } else {
            await api(orgApi(`/proofs/utility-bills/${item.id}/reject`), {
                method: 'POST',
                body,
            });
        }
        rejectModal.value.open = false;
        toast.success('Receipt rejected');
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Reject failed');
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
            <p class="mb-4 text-sm text-slate-600">
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

            <div
                v-if="!loading && payments.length + utilityBills.length > 0"
                class="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
            >
                <span class="text-lg">🔔</span>
                <p class="text-sm font-medium text-amber-900">
                    {{ payments.length + utilityBills.length }} receipt{{
                        payments.length + utilityBills.length > 1 ? 's' : ''
                    }}
                    need your review
                    <span class="font-normal text-amber-800">
                        — {{ payments.length }} rent,
                        {{ utilityBills.length }} utility
                    </span>
                </p>
            </div>

            <p
                v-if="error"
                class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
                {{ error }}
            </p>

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
                        class="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                    >
                        Rent receipts awaiting verification
                        <span
                            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1"
                            :class="
                                payments.length > 0
                                    ? 'bg-amber-100 text-amber-800 ring-amber-200'
                                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                            "
                            >{{ payments.length }}</span
                        >
                    </h2>
                    <div
                        v-if="!payments.length"
                        class="flex flex-col items-center gap-2 px-4 py-10 text-center"
                    >
                        <span class="text-2xl">✓</span>
                        <p class="text-sm font-medium text-slate-700">
                            All clear
                        </p>
                        <p class="text-xs text-slate-500">
                            No rent receipts pending review right now.
                        </p>
                    </div>
                    <ul v-else class="divide-y divide-slate-100">
                        <li
                            v-for="p in payments"
                            :key="p.id"
                            class="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div class="min-w-0 text-sm">
                                <p class="font-medium text-slate-900">
                                    {{ formatMoney(p.amount, p.currency) }} ·
                                    due
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
                                    @click="openRejectPayment(p)"
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
                        class="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                    >
                        Utility receipts awaiting verification
                        <span
                            class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1"
                            :class="
                                utilityBills.length > 0
                                    ? 'bg-amber-100 text-amber-800 ring-amber-200'
                                    : 'bg-slate-100 text-slate-600 ring-slate-200'
                            "
                            >{{ utilityBills.length }}</span
                        >
                    </h2>
                    <div
                        v-if="!utilityBills.length"
                        class="flex flex-col items-center gap-2 px-4 py-10 text-center"
                    >
                        <span class="text-2xl">✓</span>
                        <p class="text-sm font-medium text-slate-700">
                            All clear
                        </p>
                        <p class="text-xs text-slate-500">
                            No utility receipts pending review right now.
                        </p>
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
                                    @click="openRejectUtility(b)"
                                >
                                    Reject
                                </button>
                            </div>
                        </li>
                    </ul>
                </section>
            </div>
        </template>

        <Teleport to="body">
            <Transition
                enter-active-class="duration-150 ease-out"
                enter-from-class="opacity-0"
                enter-to-class="opacity-100"
                leave-active-class="duration-100 ease-in"
                leave-from-class="opacity-100"
                leave-to-class="opacity-0"
            >
                <div
                    v-if="rejectModal.open"
                    class="fixed inset-0 z-50 flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="reject-modal-title"
                >
                    <div
                        class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                        @click="rejectModal.open = false"
                    />
                    <div
                        class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/60"
                    >
                        <h3
                            id="reject-modal-title"
                            class="text-base font-semibold text-slate-900"
                        >
                            Reject receipt
                        </h3>
                        <p
                            class="mt-1.5 text-sm leading-relaxed text-slate-600"
                        >
                            Optionally explain why to the tenant. This note will
                            appear in their portal.
                        </p>
                        <label class="mt-4 block">
                            <span class="text-sm font-medium text-slate-700"
                                >Note
                                <span class="font-normal text-slate-500"
                                    >(optional)</span
                                ></span
                            >
                            <textarea
                                v-model="rejectModal.note"
                                rows="3"
                                class="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-400/20"
                                placeholder="e.g. Receipt is blurry, please re-upload a clear photo."
                                autofocus
                            />
                        </label>
                        <div class="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                @click="rejectModal.open = false"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                :disabled="!!busyId"
                                @click="submitReject"
                            >
                                {{ busyId ? 'Rejecting…' : 'Reject receipt' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Transition>
        </Teleport>
    </div>
</template>
