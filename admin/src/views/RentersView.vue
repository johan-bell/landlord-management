<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { UsersIcon } from '@heroicons/vue/24/outline';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import { formatDate, formatDateTime, formatMoney } from '../composables/format';
import type { Lease, Paginated, Renter } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';
import EmptyState from '../components/EmptyState.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useToastStore } from '../stores/toast';

const { hasOrg, orgApi } = useOrgContext();
const toast = useToastStore();

const renters = ref<Renter[]>([]);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const showAdd = ref(false);
const form = ref({
    fullName: '',
    phone: '',
    email: '',
    initialPassword: '',
    initialPasswordConfirm: '',
});
const saving = ref(false);

const historyRenter = ref<Renter | null>(null);
const historyLoading = ref(false);
const historyError = ref<string | null>(null);
const historyLeases = ref<Lease[]>([]);

const confirmRemoveRenter = ref<Renter | null>(null);

const PAGE_SIZE = 20;

const renterReliability = computed(() => {
    if (!historyLeases.value.length) return null;
    let total = 0;
    let paid = 0;
    let late = 0;
    for (const lease of historyLeases.value) {
        for (const p of lease.payments ?? []) {
            if (p.status === 'CANCELLED') continue;
            total++;
            if (p.status === 'PAID') paid++;
            if (p.status === 'LATE') late++;
        }
    }
    if (total === 0) return null;
    const rate = paid / total;
    const grade =
        rate >= 0.95
            ? 'excellent'
            : rate >= 0.8
              ? 'good'
              : rate >= 0.6
                ? 'fair'
                : 'poor';
    return { total, paid, late, pending: total - paid - late, rate, grade };
});

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        const qs = new URLSearchParams({
            page: String(page.value),
            limit: String(PAGE_SIZE),
        });
        if (search.value.trim()) qs.set('search', search.value.trim());
        const data = await api<Paginated<Renter>>(
            `${orgApi('/renters')}?${qs}`,
        );
        renters.value = data.items;
        totalPages.value = Math.max(1, data.totalPages);
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
    } finally {
        loading.value = false;
    }
}

function applySearch() {
    page.value = 1;
    void load();
}


async function save() {
    const fullName = form.value.fullName.trim();
    if (!fullName) return;
    const pwd = form.value.initialPassword.trim();
    const pwd2 = form.value.initialPasswordConfirm.trim();
    if (pwd || pwd2) {
        if (pwd !== pwd2) {
            error.value = 'Passwords do not match';
            return;
        }
        if (pwd.length < 8) {
            error.value = 'Portal password must be at least 8 characters';
            return;
        }
        if (!form.value.email.trim()) {
            error.value = 'Email is required when setting a portal password';
            return;
        }
    }
    saving.value = true;
    error.value = null;
    try {
        const body: Record<string, string | undefined> = {
            fullName,
            phone: form.value.phone.trim() || undefined,
            email: form.value.email.trim() || undefined,
        };
        if (pwd) body.initialPassword = pwd;
        await api(orgApi('/renters'), {
            method: 'POST',
            body: JSON.stringify(body),
        });
        form.value = {
            fullName: '',
            phone: '',
            email: '',
            initialPassword: '',
            initialPasswordConfirm: '',
        };
        showAdd.value = false;
        toast.success(`${fullName} added`);
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Save failed';
    } finally {
        saving.value = false;
    }
}

function closeHistory() {
    historyRenter.value = null;
    historyLeases.value = [];
    historyError.value = null;
}

async function openHistory(r: Renter) {
    historyRenter.value = r;
    historyLeases.value = [];
    historyError.value = null;
    historyLoading.value = true;
    try {
        const res = await api<{ leases: Lease[] }>(
            orgApi(`/renters/${r.id}/payment-history`),
        );
        historyLeases.value = res.leases;
    } catch (e) {
        historyError.value =
            e instanceof Error ? e.message : 'Could not load payment history';
    } finally {
        historyLoading.value = false;
    }
}

async function confirmRemove() {
    const r = confirmRemoveRenter.value;
    if (!r) return;
    confirmRemoveRenter.value = null;
    try {
        await api(orgApi(`/renters/${r.id}`), { method: 'DELETE' });
        toast.success(`${r.fullName} removed`);
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
}

function utilityPeriod(y: number, m: number) {
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
    });
}

function payStatusClass(s: string) {
    if (s === 'PAID') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    if (s === 'LATE') return 'bg-red-50 text-red-800 ring-red-200';
    return 'bg-amber-50 text-amber-800 ring-amber-200';
}

function reliabilityColors(grade: string) {
    if (grade === 'excellent')
        return {
            badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
            bar: 'bg-emerald-500',
        };
    if (grade === 'good')
        return {
            badge: 'bg-sky-100 text-sky-800 ring-sky-200',
            bar: 'bg-sky-500',
        };
    if (grade === 'fair')
        return {
            badge: 'bg-amber-100 text-amber-800 ring-amber-200',
            bar: 'bg-amber-400',
        };
    return {
        badge: 'bg-red-100 text-red-800 ring-red-200',
        bar: 'bg-red-500',
    };
}

onMounted(() => void load());
watch(hasOrg, () => void load());
watch(page, () => void load());
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <div
                class="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between"
            >
                <p class="text-sm text-slate-600">
                    People who rent units under this organization.
                </p>
                <div class="flex flex-wrap items-center gap-2">
                    <input
                        v-model="search"
                        type="search"
                        placeholder="Search name, email, phone…"
                        class="min-w-50 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        @keydown.enter.prevent="applySearch"
                    />
                    <button
                        type="button"
                        class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        @click="applySearch"
                    >
                        Search
                    </button>
                </div>
                <button
                    type="button"
                    class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                    @click="showAdd = true"
                >
                    Add renter
                </button>
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

            <template v-else>
                <EmptyState
                    v-if="!renters.length && !search"
                    :icon="UsersIcon"
                    title="No renters yet"
                    description="Add your first renter to start assigning units and tracking rent."
                    action-label="Add renter"
                    @action="showAdd = true"
                />

                <div
                    v-else
                    class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                    <table
                        class="min-w-full divide-y divide-slate-200 text-left text-sm"
                    >
                        <thead
                            class="sticky top-0 z-10 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                            <tr>
                                <th class="px-4 py-3">Name</th>
                                <th class="hidden px-4 py-3 sm:table-cell">
                                    Phone
                                </th>
                                <th class="hidden px-4 py-3 md:table-cell">
                                    Email
                                </th>
                                <th class="hidden px-4 py-3 lg:table-cell">
                                    Portal
                                </th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="r in renters"
                                :key="r.id"
                                class="hover:bg-slate-50/80"
                            >
                                <td
                                    class="px-4 py-3 font-medium text-slate-900"
                                >
                                    {{ r.fullName }}
                                </td>
                                <td
                                    class="hidden px-4 py-3 text-slate-600 sm:table-cell"
                                >
                                    {{ r.phone ?? '—' }}
                                </td>
                                <td
                                    class="hidden px-4 py-3 text-slate-600 md:table-cell"
                                >
                                    {{ r.email ?? '—' }}
                                </td>
                                <td class="hidden px-4 py-3 lg:table-cell">
                                    <span
                                        v-if="r.userId"
                                        class="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                                    >
                                        Active
                                    </span>
                                    <span v-else class="text-xs text-slate-400"
                                        >—</span
                                    >
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        class="mr-3 text-sm font-medium text-indigo-700 hover:underline"
                                        @click="openHistory(r)"
                                    >
                                        History
                                    </button>
                                    <button
                                        type="button"
                                        class="text-sm font-medium text-red-600 hover:underline"
                                        @click="confirmRemoveRenter = r"
                                    >
                                        Remove
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <p
                        v-if="renters.length === 0 && search"
                        class="px-4 py-10 text-center text-sm text-slate-500"
                    >
                        No renters match your search.
                    </p>
                </div>
            </template>

            <div
                v-if="!loading && totalPages > 1"
                class="mt-6 flex items-center justify-center gap-4 text-sm text-slate-600"
            >
                <button
                    type="button"
                    class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
                    :disabled="page <= 1"
                    @click="page--"
                >
                    Previous
                </button>
                <span>Page {{ page }} / {{ totalPages }}</span>
                <button
                    type="button"
                    class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
                    :disabled="page >= totalPages"
                    @click="page++"
                >
                    Next
                </button>
            </div>

            <ConfirmDialog
                :open="confirmRemoveRenter !== null"
                title="Remove renter"
                :message="`Remove ${confirmRemoveRenter?.fullName ?? 'this renter'} from the organization? This does not delete their lease history.`"
                confirm-label="Remove"
                danger
                @update:open="
                    (v) => {
                        if (!v) confirmRemoveRenter = null;
                    }
                "
                @confirm="confirmRemove"
            />

            <Teleport to="body">
                <div
                    v-if="historyRenter"
                    class="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
                    @click.self="closeHistory"
                >
                    <div
                        class="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
                        @click.stop
                    >
                        <div
                            class="shrink-0 border-b border-slate-100 px-5 py-4 sm:px-6"
                        >
                            <div
                                class="flex flex-wrap items-start justify-between gap-3"
                            >
                                <div>
                                    <h3
                                        class="text-lg font-semibold text-slate-900"
                                    >
                                        Payment history
                                    </h3>
                                    <p class="mt-0.5 text-sm text-slate-600">
                                        {{ historyRenter.fullName }}
                                        <span
                                            v-if="historyRenter.email"
                                            class="text-slate-500"
                                        >
                                            · {{ historyRenter.email }}
                                        </span>
                                    </p>
                                </div>

                                <div
                                    v-if="renterReliability"
                                    class="flex flex-col items-end gap-1.5"
                                >
                                    <span
                                        class="inline-flex rounded-full px-3 py-0.5 text-xs font-semibold capitalize ring-1"
                                        :class="
                                            reliabilityColors(
                                                renterReliability.grade,
                                            ).badge
                                        "
                                    >
                                        {{ renterReliability.grade }} payer
                                    </span>
                                    <div class="flex items-center gap-2">
                                        <div
                                            class="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100"
                                        >
                                            <div
                                                class="h-full rounded-full transition-all"
                                                :class="
                                                    reliabilityColors(
                                                        renterReliability.grade,
                                                    ).bar
                                                "
                                                :style="{
                                                    width: `${Math.round(renterReliability.rate * 100)}%`,
                                                }"
                                            />
                                        </div>
                                        <span
                                            class="text-xs text-slate-500 tabular-nums"
                                        >
                                            {{
                                                Math.round(
                                                    renterReliability.rate *
                                                        100,
                                                )
                                            }}% on time ({{
                                                renterReliability.paid
                                            }}/{{ renterReliability.total }})
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            class="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
                        >
                            <div
                                v-if="historyLoading"
                                class="py-12 text-center text-sm text-slate-500"
                            >
                                Loading…
                            </div>
                            <p
                                v-else-if="historyError"
                                class="text-sm text-red-600"
                            >
                                {{ historyError }}
                            </p>
                            <div
                                v-else-if="!historyLeases.length"
                                class="py-8 text-center text-sm text-slate-500"
                            >
                                No leases yet — add a lease to see rent and
                                utility charges.
                            </div>
                            <div v-else class="space-y-8">
                                <section
                                    v-for="lease in historyLeases"
                                    :key="lease.id"
                                    class="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                                >
                                    <p
                                        class="text-sm font-semibold text-slate-900"
                                    >
                                        {{ lease.unit.property.name }} ·
                                        {{ lease.unit.label }}
                                    </p>
                                    <p class="mt-1 text-xs text-slate-500">
                                        Lease
                                        {{ formatDate(lease.startDate) }} —
                                        {{
                                            lease.endDate
                                                ? formatDate(lease.endDate)
                                                : 'Ongoing'
                                        }}
                                        · Rent
                                        {{
                                            formatMoney(
                                                lease.rentAmount,
                                                lease.currency,
                                            )
                                        }}/mo
                                    </p>

                                    <h4
                                        class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                                    >
                                        Rent schedule
                                    </h4>
                                    <div
                                        class="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white"
                                    >
                                        <table
                                            class="min-w-full divide-y divide-slate-100 text-left text-xs"
                                        >
                                            <thead
                                                class="bg-slate-50 text-slate-500"
                                            >
                                                <tr>
                                                    <th
                                                        class="px-3 py-2 font-medium"
                                                    >
                                                        Due
                                                    </th>
                                                    <th
                                                        class="px-3 py-2 font-medium"
                                                    >
                                                        Amount
                                                    </th>
                                                    <th
                                                        class="px-3 py-2 font-medium"
                                                    >
                                                        Status
                                                    </th>
                                                    <th
                                                        class="px-3 py-2 font-medium"
                                                    >
                                                        Paid at
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody
                                                class="divide-y divide-slate-100"
                                            >
                                                <tr
                                                    v-for="p in lease.payments ??
                                                    []"
                                                    :key="p.id"
                                                >
                                                    <td
                                                        class="px-3 py-2 text-slate-700"
                                                    >
                                                        {{
                                                            formatDate(
                                                                p.dueDate,
                                                            )
                                                        }}
                                                    </td>
                                                    <td
                                                        class="px-3 py-2 font-medium tabular-nums text-slate-900"
                                                    >
                                                        {{
                                                            formatMoney(
                                                                p.amount,
                                                                p.currency,
                                                            )
                                                        }}
                                                    </td>
                                                    <td class="px-3 py-2">
                                                        <span
                                                            class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1"
                                                            :class="
                                                                payStatusClass(
                                                                    p.status,
                                                                )
                                                            "
                                                            >{{
                                                                p.status
                                                            }}</span
                                                        >
                                                    </td>
                                                    <td
                                                        class="px-3 py-2 text-slate-500"
                                                    >
                                                        {{
                                                            p.paidAt
                                                                ? formatDateTime(
                                                                      p.paidAt,
                                                                  )
                                                                : '—'
                                                        }}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <template
                                        v-if="
                                            (lease.utilityBills ?? []).length >
                                            0
                                        "
                                    >
                                        <h4
                                            class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500"
                                        >
                                            Utilities (recent)
                                        </h4>
                                        <div
                                            class="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white"
                                        >
                                            <table
                                                class="min-w-full divide-y divide-slate-100 text-left text-xs"
                                            >
                                                <thead
                                                    class="bg-slate-50 text-slate-500"
                                                >
                                                    <tr>
                                                        <th
                                                            class="px-3 py-2 font-medium"
                                                        >
                                                            Period
                                                        </th>
                                                        <th
                                                            class="px-3 py-2 font-medium"
                                                        >
                                                            Kind
                                                        </th>
                                                        <th
                                                            class="px-3 py-2 font-medium"
                                                        >
                                                            Due
                                                        </th>
                                                        <th
                                                            class="px-3 py-2 font-medium"
                                                        >
                                                            Amount
                                                        </th>
                                                        <th
                                                            class="px-3 py-2 font-medium"
                                                        >
                                                            Status
                                                        </th>
                                                        <th
                                                            class="px-3 py-2 font-medium"
                                                        >
                                                            Paid at
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody
                                                    class="divide-y divide-slate-100"
                                                >
                                                    <tr
                                                        v-for="b in lease.utilityBills ??
                                                        []"
                                                        :key="b.id"
                                                    >
                                                        <td
                                                            class="px-3 py-2 text-slate-700"
                                                        >
                                                            {{
                                                                utilityPeriod(
                                                                    b.year,
                                                                    b.month,
                                                                )
                                                            }}
                                                        </td>
                                                        <td
                                                            class="px-3 py-2 text-slate-600"
                                                        >
                                                            {{ b.kind }}
                                                        </td>
                                                        <td
                                                            class="px-3 py-2 text-slate-700"
                                                        >
                                                            {{
                                                                formatDate(
                                                                    b.dueDate,
                                                                )
                                                            }}
                                                        </td>
                                                        <td
                                                            class="px-3 py-2 font-medium tabular-nums text-slate-900"
                                                        >
                                                            {{
                                                                formatMoney(
                                                                    b.amount,
                                                                    b.currency,
                                                                )
                                                            }}
                                                        </td>
                                                        <td class="px-3 py-2">
                                                            <span
                                                                class="inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1"
                                                                :class="
                                                                    payStatusClass(
                                                                        b.status,
                                                                    )
                                                                "
                                                                >{{
                                                                    b.status
                                                                }}</span
                                                            >
                                                        </td>
                                                        <td
                                                            class="px-3 py-2 text-slate-500"
                                                        >
                                                            {{
                                                                b.paidAt
                                                                    ? formatDateTime(
                                                                          b.paidAt,
                                                                      )
                                                                    : '—'
                                                            }}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </template>
                                </section>
                            </div>
                        </div>

                        <div
                            class="shrink-0 border-t border-slate-100 px-5 py-3 sm:px-6"
                        >
                            <button
                                type="button"
                                class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                @click="closeHistory"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>

            <Teleport to="body">
                <div
                    v-if="showAdd"
                    class="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
                    @click.self="showAdd = false"
                >
                    <div
                        class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        @click.stop
                    >
                        <h3 class="text-lg font-semibold">New renter</h3>
                        <label class="mt-4 block">
                            <span class="text-sm font-medium">Full name</span>
                            <input
                                v-model="form.fullName"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>
                        <label class="mt-3 block">
                            <span class="text-sm font-medium"
                                >Phone (optional)</span
                            >
                            <input
                                v-model="form.phone"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>
                        <label class="mt-3 block">
                            <span class="text-sm font-medium">Email</span>
                            <input
                                v-model="form.email"
                                type="email"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                autocomplete="off"
                            />
                            <span class="mt-1 block text-xs text-slate-500">
                                Required if you set a portal password below.
                            </span>
                        </label>
                        <label class="mt-3 block">
                            <span class="text-sm font-medium"
                                >Initial portal password</span
                            >
                            <input
                                v-model="form.initialPassword"
                                type="password"
                                minlength="8"
                                autocomplete="new-password"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                placeholder="Optional — tenant signs in with this, then can change it"
                            />
                        </label>
                        <label class="mt-3 block">
                            <span class="text-sm font-medium"
                                >Confirm password</span
                            >
                            <input
                                v-model="form.initialPasswordConfirm"
                                type="password"
                                minlength="8"
                                autocomplete="new-password"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>
                        <p v-if="error" class="mt-3 text-sm text-red-600">
                            {{ error }}
                        </p>
                        <div class="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                @click="showAdd = false"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                :disabled="saving || !form.fullName.trim()"
                                @click="save"
                            >
                                {{ saving ? 'Saving…' : 'Save' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
        </template>
    </div>
</template>
