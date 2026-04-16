<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import { formatDate, formatMoney } from '../composables/format';
import type {
    Lease,
    LeaseUtilityBill,
    Paginated,
    Property,
    Renter,
    Unit,
} from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();

const leases = ref<Lease[]>([]);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const unitOptions = ref<{ id: string; label: string; propertyName: string }[]>(
    [],
);
const renters = ref<Renter[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showAdd = ref(false);
const form = ref({
    unitId: '',
    renterId: '',
    startDate: new Date().toISOString().slice(0, 10),
    rentAmount: '',
    dueDay: '1',
    prepaidMonths: '0',
});
const saving = ref(false);

const showUtilities = ref(false);
const utilitiesLease = ref<Lease | null>(null);
const utilityBills = ref<LeaseUtilityBill[]>([]);
const utilitiesLoading = ref(false);
const utilSaving = ref(false);
const utilForm = ref({
    kind: 'ELECTRICITY' as 'ELECTRICITY' | 'WATER',
    utilityBillingMode: 'meter' as 'meter' | 'manual',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    amount: '',
    currentMeterIndex: '',
    previousMeterIndex: '',
    dueDate: '',
});

function defaultUtilityDueIso(lease: Lease, year: number, month: number) {
    const day = Math.min(Math.max(1, lease.dueDay), 28);
    const d = new Date(year, month - 1, day);
    return d.toISOString().slice(0, 10);
}

function kindOptionsForLease(lease: Lease) {
    const o: { value: 'ELECTRICITY' | 'WATER'; label: string }[] = [];
    if (lease.unit.electricityBilling === 'METERED_KWH') {
        o.push({ value: 'ELECTRICITY', label: 'Electricity' });
    }
    if (lease.unit.waterBilling === 'METERED_M3') {
        o.push({ value: 'WATER', label: 'Water' });
    }
    return o;
}

async function openUtilities(lease: Lease) {
    utilitiesLease.value = lease;
    const opts = kindOptionsForLease(lease);
    utilForm.value.kind = opts[0]?.value ?? 'ELECTRICITY';
    utilForm.value.utilityBillingMode = 'meter';
    const now = new Date();
    utilForm.value.year = now.getFullYear();
    utilForm.value.month = now.getMonth() + 1;
    utilForm.value.amount = '';
    utilForm.value.currentMeterIndex = '';
    utilForm.value.previousMeterIndex = '';
    utilForm.value.dueDate = defaultUtilityDueIso(
        lease,
        utilForm.value.year,
        utilForm.value.month,
    );
    showUtilities.value = true;
    await loadUtilityBills();
}

async function loadUtilityBills() {
    const lease = utilitiesLease.value;
    if (!hasOrg.value || !lease) return;
    utilitiesLoading.value = true;
    try {
        utilityBills.value = await api<LeaseUtilityBill[]>(
            orgApi(`/leases/${lease.id}/utility-bills`),
        );
    } catch {
        utilityBills.value = [];
    } finally {
        utilitiesLoading.value = false;
    }
}

/** `type="number"` v-model may be string or number — never call `.trim()` blindly. */
function utilNumericFieldOk(
    raw: string | number | null | undefined,
): { ok: boolean; n: number } {
    if (raw === null || raw === undefined) {
        return { ok: false, n: NaN };
    }
    if (typeof raw === 'number') {
        return { ok: Number.isFinite(raw) && raw >= 0, n: raw };
    }
    const s = raw.trim();
    if (s === '') return { ok: false, n: NaN };
    const n = Number.parseFloat(s);
    return { ok: Number.isFinite(n) && n >= 0, n };
}

function utilityLastReadingHint() {
    const same = utilityBills.value
        .filter((b) => b.kind === utilForm.value.kind)
        .sort((a, b) => b.year - a.year || b.month - a.month)[0];
    if (same?.currentIndex != null && same.currentIndex !== '') {
        return `Last reading on file: ${same.currentIndex} (${utilityMonthLabel(same)}). Leave “previous” empty to reuse it.`;
    }
    return 'First bill for this utility: enter the previous meter reading below (or add an earlier month first).';
}

async function saveUtilityBill() {
    const lease = utilitiesLease.value;
    if (!lease || !canSaveUtility.value) return;
    utilSaving.value = true;
    try {
        const base = {
            kind: utilForm.value.kind,
            year: utilForm.value.year,
            month: utilForm.value.month,
            dueDate: new Date(utilForm.value.dueDate).toISOString(),
            currency: lease.currency,
        };
        const curMeter = utilNumericFieldOk(utilForm.value.currentMeterIndex);
        const prevMeter = utilNumericFieldOk(utilForm.value.previousMeterIndex);
        const body =
            utilForm.value.utilityBillingMode === 'meter'
                ? {
                      ...base,
                      currentMeterIndex: curMeter.n,
                      ...(prevMeter.ok ? { previousMeterIndex: prevMeter.n } : {}),
                  }
                : {
                      ...base,
                      amount: utilNumericFieldOk(utilForm.value.amount).n,
                  };
        await api(orgApi(`/leases/${lease.id}/utility-bills`), {
            method: 'POST',
            body: JSON.stringify(body),
        });
        utilForm.value.amount = '';
        utilForm.value.currentMeterIndex = '';
        utilForm.value.previousMeterIndex = '';
        await loadUtilityBills();
    } catch (e) {
        error.value =
            e instanceof Error ? e.message : 'Could not save utility bill';
    } finally {
        utilSaving.value = false;
    }
}

async function markUtilityPaid(b: LeaseUtilityBill) {
    const lease = utilitiesLease.value;
    if (!lease) return;
    try {
        await api(orgApi(`/leases/${lease.id}/utility-bills/${b.id}`), {
            method: 'PATCH',
            body: JSON.stringify({ status: 'PAID' }),
        });
        await loadUtilityBills();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Update failed';
    }
}

async function markUtilityPending(b: LeaseUtilityBill) {
    const lease = utilitiesLease.value;
    if (!lease) return;
    try {
        await api(orgApi(`/leases/${lease.id}/utility-bills/${b.id}`), {
            method: 'PATCH',
            body: JSON.stringify({ status: 'PENDING' }),
        });
        await loadUtilityBills();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Update failed';
    }
}

async function removeUtilityBill(b: LeaseUtilityBill) {
    const lease = utilitiesLease.value;
    if (!lease) return;
    if (!confirm('Remove this utility charge?')) return;
    try {
        await api(orgApi(`/leases/${lease.id}/utility-bills/${b.id}`), {
            method: 'DELETE',
        });
        await loadUtilityBills();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Delete failed';
    }
}

function utilityMonthLabel(b: LeaseUtilityBill) {
    return new Date(b.year, b.month - 1, 1).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
    });
}

function onUtilPeriodChange() {
    const lease = utilitiesLease.value;
    if (!lease) return;
    utilForm.value.dueDate = defaultUtilityDueIso(
        lease,
        utilForm.value.year,
        utilForm.value.month,
    );
}

const canSaveUtility = computed(() => {
    if (utilForm.value.utilityBillingMode === 'meter') {
        return utilNumericFieldOk(utilForm.value.currentMeterIndex).ok;
    }
    return utilNumericFieldOk(utilForm.value.amount).ok;
});

async function loadUnitsAndRenters() {
    if (!hasOrg.value) return;
    const propsRes = await api<Paginated<Property>>(
        orgApi('/properties?limit=500'),
    );
    const pairs: { id: string; label: string; propertyName: string }[] = [];
    for (const p of propsRes.items) {
        const unitsRes = await api<Paginated<Unit>>(
            orgApi(`/properties/${p.id}/units?limit=500`),
        );
        for (const u of unitsRes.items) {
            pairs.push({
                id: u.id,
                label: u.label,
                propertyName: p.name,
            });
        }
    }
    unitOptions.value = pairs;
    const renRes = await api<Paginated<Renter>>(orgApi('/renters?limit=500'));
    renters.value = renRes.items;
}

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        await loadUnitsAndRenters();
        const qs = new URLSearchParams({
            page: String(page.value),
            limit: '20',
        });
        if (search.value.trim()) qs.set('search', search.value.trim());
        const data = await api<Paginated<Lease>>(`${orgApi('/leases')}?${qs}`);
        leases.value = data.items as Lease[];
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

async function createLease() {
    const unitId = form.value.unitId;
    const renterId = form.value.renterId;
    const rent = Number.parseFloat(form.value.rentAmount);
    if (!unitId || !renterId || Number.isNaN(rent)) return;
    saving.value = true;
    try {
        const prepaid = Number.parseInt(form.value.prepaidMonths, 10);
        await api(orgApi('/leases'), {
            method: 'POST',
            body: JSON.stringify({
                unitId,
                renterId,
                startDate: new Date(form.value.startDate).toISOString(),
                rentAmount: rent,
                dueDay: Number.parseInt(form.value.dueDay, 10) || 1,
                prepaidMonths: Number.isNaN(prepaid)
                    ? 0
                    : Math.min(60, Math.max(0, prepaid)),
            }),
        });
        showAdd.value = false;
        form.value = {
            unitId: '',
            renterId: '',
            startDate: new Date().toISOString().slice(0, 10),
            rentAmount: '',
            dueDay: '1',
            prepaidMonths: '0',
        };
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Could not create lease';
    } finally {
        saving.value = false;
    }
}

async function removeLease(l: Lease) {
    if (!confirm('Delete this lease? Unit will be marked vacant.')) return;
    try {
        await api(orgApi(`/leases/${l.id}`), { method: 'DELETE' });
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Delete failed';
    }
}

const canSubmit = computed(() => {
    const rent = Number.parseFloat(form.value.rentAmount);
    return Boolean(
        form.value.unitId &&
        form.value.renterId &&
        form.value.startDate &&
        !Number.isNaN(rent),
    );
});

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
                    Agreements between renters and units.
                </p>
                <div class="flex flex-wrap items-center gap-2">
                    <input
                        v-model="search"
                        type="search"
                        placeholder="Search renter or unit…"
                        class="min-w-[200px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                    New lease
                </button>
            </div>

            <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

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
                        class="min-w-[640px] w-full divide-y divide-slate-200 text-left text-sm"
                    >
                        <thead
                            class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                            <tr>
                                <th class="px-4 py-3">Renter</th>
                                <th class="px-4 py-3">Unit</th>
                                <th class="px-4 py-3">Rent</th>
                                <th class="px-4 py-3">Start</th>
                                <th class="px-4 py-3">Due day</th>
                                <th class="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="l in leases"
                                :key="l.id"
                                class="hover:bg-slate-50/80"
                            >
                                <td
                                    class="px-4 py-3 font-medium text-slate-900"
                                >
                                    {{ l.renter.fullName }}
                                </td>
                                <td class="px-4 py-3 text-slate-600">
                                    {{ l.unit.label }}
                                    <span
                                        class="block text-xs text-slate-400"
                                        >{{ l.unit.property.name }}</span
                                    >
                                </td>
                                <td class="px-4 py-3 tabular-nums">
                                    {{ formatMoney(l.rentAmount, l.currency) }}
                                </td>
                                <td class="px-4 py-3 text-slate-600">
                                    {{ formatDate(l.startDate) }}
                                </td>
                                <td class="px-4 py-3">{{ l.dueDay }}</td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        v-if="kindOptionsForLease(l).length"
                                        type="button"
                                        class="mr-3 text-sm font-medium text-emerald-700 hover:underline"
                                        @click="openUtilities(l)"
                                    >
                                        Utilities
                                    </button>
                                    <button
                                        type="button"
                                        class="text-sm font-medium text-red-600 hover:underline"
                                        @click="removeLease(l)"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p
                    v-if="!leases.length"
                    class="px-4 py-10 text-center text-sm text-slate-500"
                >
                    No leases yet.
                </p>
            </div>

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

            <Teleport to="body">
                <div
                    v-if="showAdd"
                    class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
                    @click.self="showAdd = false"
                >
                    <div
                        class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        @click.stop
                    >
                        <h3 class="text-lg font-semibold">Create lease</h3>
                        <p class="mt-1 text-sm text-slate-500">
                            Links a renter to a unit. The unit must be vacant.
                        </p>

                        <label class="mt-4 block">
                            <span class="text-sm font-medium">Unit</span>
                            <select
                                v-model="form.unitId"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            >
                                <option value="" disabled>Select unit</option>
                                <option
                                    v-for="o in unitOptions"
                                    :key="o.id"
                                    :value="o.id"
                                >
                                    {{ o.propertyName }} — {{ o.label }}
                                </option>
                            </select>
                        </label>

                        <label class="mt-3 block">
                            <span class="text-sm font-medium">Renter</span>
                            <select
                                v-model="form.renterId"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            >
                                <option value="" disabled>Select renter</option>
                                <option
                                    v-for="r in renters"
                                    :key="r.id"
                                    :value="r.id"
                                >
                                    {{ r.fullName }}
                                </option>
                            </select>
                        </label>

                        <label class="mt-3 block">
                            <span class="text-sm font-medium">Start date</span>
                            <input
                                v-model="form.startDate"
                                type="date"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>

                        <label class="mt-3 block">
                            <span class="text-sm font-medium"
                                >Monthly rent</span
                            >
                            <input
                                v-model="form.rentAmount"
                                type="number"
                                min="0"
                                step="1"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>

                        <label class="mt-3 block">
                            <span class="text-sm font-medium"
                                >Rent due day of month (1–28)</span
                            >
                            <input
                                v-model="form.dueDay"
                                type="number"
                                min="1"
                                max="28"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>

                        <label class="mt-3 block">
                            <span class="text-sm font-medium"
                                >Months prepaid upfront (0–60)</span
                            >
                            <input
                                v-model="form.prepaidMonths"
                                type="number"
                                min="0"
                                max="60"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                            <span class="mt-1 block text-xs text-slate-500">
                                Records that many monthly payments as already
                                paid (tenant sees them as paid on the portal).
                            </span>
                        </label>

                        <div class="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2 text-sm text-slate-600"
                                @click="showAdd = false"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                :disabled="saving || !canSubmit"
                                @click="createLease"
                            >
                                {{ saving ? 'Saving…' : 'Create lease' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>

            <Teleport to="body">
                <div
                    v-if="showUtilities && utilitiesLease"
                    class="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
                    @click.self="showUtilities = false"
                >
                    <div
                        class="my-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        @click.stop
                    >
                        <h3 class="text-lg font-semibold">Monthly utilities</h3>
                        <p class="mt-1 text-sm text-slate-500">
                            {{ utilitiesLease.renter.fullName }} ·
                            {{ utilitiesLease.unit.property.name }} —
                            {{ utilitiesLease.unit.label }}
                        </p>
                        <p class="mt-2 text-xs text-slate-500">
                            For metered units, enter the new index; the amount is
                            (current − previous) × your per‑m³ or per‑kWh rate.
                            Tenants upload a payment receipt; you verify it under
                            Receipts before it shows paid in their portal.
                        </p>

                        <div
                            v-if="utilitiesLoading"
                            class="mt-6 py-8 text-center text-sm text-slate-500"
                        >
                            Loading…
                        </div>
                        <div
                            v-else
                            class="mt-4 overflow-x-auto rounded-xl border border-slate-200"
                        >
                            <table
                                class="min-w-full divide-y divide-slate-200 text-left text-sm"
                            >
                                <thead
                                    class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                                >
                                    <tr>
                                        <th class="px-3 py-2">Period</th>
                                        <th class="px-3 py-2">Type</th>
                                        <th class="px-3 py-2">Meter</th>
                                        <th class="px-3 py-2">Amount</th>
                                        <th class="px-3 py-2">Due</th>
                                        <th class="px-3 py-2">Status</th>
                                        <th class="px-3 py-2">Receipt</th>
                                        <th class="px-3 py-2 text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    <tr
                                        v-for="b in utilityBills"
                                        :key="b.id"
                                        class="hover:bg-slate-50/80"
                                    >
                                        <td class="px-3 py-2">
                                            {{ utilityMonthLabel(b) }}
                                        </td>
                                        <td class="px-3 py-2">
                                            {{
                                                b.kind === 'ELECTRICITY'
                                                    ? 'Electricity'
                                                    : 'Water'
                                            }}
                                        </td>
                                        <td
                                            class="max-w-[10rem] px-3 py-2 text-xs text-slate-600"
                                        >
                                            <template
                                                v-if="
                                                    b.consumption != null &&
                                                    b.consumption !== ''
                                                "
                                            >
                                                Δ {{ b.consumption }}
                                                {{
                                                    b.kind === 'ELECTRICITY'
                                                        ? 'kWh'
                                                        : 'm³'
                                                }}
                                                <span
                                                    v-if="b.previousIndex"
                                                    class="block text-slate-400"
                                                    >{{ b.previousIndex }} →
                                                    {{ b.currentIndex }}</span
                                                >
                                            </template>
                                            <span v-else class="text-slate-400"
                                                >—</span
                                            >
                                        </td>
                                        <td class="px-3 py-2 tabular-nums">
                                            {{
                                                formatMoney(
                                                    b.amount,
                                                    b.currency,
                                                )
                                            }}
                                        </td>
                                        <td class="px-3 py-2 text-slate-600">
                                            {{ formatDate(b.dueDate) }}
                                        </td>
                                        <td class="px-3 py-2">
                                            <span
                                                :class="[
                                                    'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                                                    b.status === 'PAID'
                                                        ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                                        : b.status === 'LATE'
                                                          ? 'bg-amber-50 text-amber-900 ring-1 ring-amber-200'
                                                          : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
                                                ]"
                                            >
                                                {{ b.status }}
                                            </span>
                                        </td>
                                        <td class="px-3 py-2 text-xs text-slate-600">
                                            {{
                                                b.proofVerification ===
                                                'PENDING_VERIFICATION'
                                                    ? 'Awaiting review'
                                                    : b.proofVerification ===
                                                        'REJECTED'
                                                      ? 'Rejected'
                                                      : b.proofVerification ===
                                                          'APPROVED'
                                                        ? 'OK'
                                                        : '—'
                                            }}
                                        </td>
                                        <td class="px-3 py-2 text-right">
                                            <button
                                                v-if="
                                                    b.status !== 'PAID' &&
                                                    b.proofVerification !==
                                                        'PENDING_VERIFICATION'
                                                "
                                                type="button"
                                                class="mr-2 text-xs font-medium text-emerald-700 hover:underline"
                                                @click="markUtilityPaid(b)"
                                            >
                                                Mark paid
                                            </button>
                                            <span
                                                v-else-if="
                                                    b.proofVerification ===
                                                    'PENDING_VERIFICATION'
                                                "
                                                class="mr-2 text-xs text-amber-800"
                                                >Receipts</span
                                            >
                                            <button
                                                v-else
                                                type="button"
                                                class="mr-2 text-xs font-medium text-slate-600 hover:underline"
                                                @click="markUtilityPending(b)"
                                            >
                                                Mark unpaid
                                            </button>
                                            <button
                                                type="button"
                                                class="text-xs font-medium text-red-600 hover:underline"
                                                @click="removeUtilityBill(b)"
                                            >
                                                Remove
                                            </button>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                            <p
                                v-if="!utilityBills.length"
                                class="px-4 py-8 text-center text-sm text-slate-500"
                            >
                                No utility charges yet. Add a month below.
                            </p>
                        </div>

                        <div
                            v-if="kindOptionsForLease(utilitiesLease).length"
                            class="mt-6 border-t border-slate-100 pt-4"
                        >
                            <p class="text-sm font-medium text-slate-800">
                                Add or update a month
                            </p>
                            <p
                                class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                            >
                                {{ utilityLastReadingHint() }}
                            </p>
                            <div class="mt-3 grid gap-3 sm:grid-cols-2">
                                <label class="block text-sm">
                                    <span class="text-slate-600">Type</span>
                                    <select
                                        v-model="utilForm.kind"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                    >
                                        <option
                                            v-for="o in kindOptionsForLease(
                                                utilitiesLease,
                                            )"
                                            :key="o.value"
                                            :value="o.value"
                                        >
                                            {{ o.label }}
                                        </option>
                                    </select>
                                </label>
                                <label class="block text-sm">
                                    <span class="text-slate-600">Billing</span>
                                    <select
                                        v-model="utilForm.utilityBillingMode"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                    >
                                        <option value="meter">
                                            From meter readings
                                        </option>
                                        <option value="manual">
                                            Manual amount
                                        </option>
                                    </select>
                                </label>
                                <label
                                    v-if="utilForm.utilityBillingMode === 'meter'"
                                    class="block text-sm"
                                >
                                    <span class="text-slate-600"
                                        >New meter index</span
                                    >
                                    <input
                                        v-model="utilForm.currentMeterIndex"
                                        type="number"
                                        min="0"
                                        step="any"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                        placeholder="Current reading"
                                    />
                                </label>
                                <label
                                    v-if="utilForm.utilityBillingMode === 'meter'"
                                    class="block text-sm"
                                >
                                    <span class="text-slate-600"
                                        >Previous index (optional)</span
                                    >
                                    <input
                                        v-model="utilForm.previousMeterIndex"
                                        type="number"
                                        min="0"
                                        step="any"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                        placeholder="Only if first bill / override"
                                    />
                                </label>
                                <label
                                    v-if="
                                        utilForm.utilityBillingMode === 'manual'
                                    "
                                    class="block text-sm sm:col-span-2"
                                >
                                    <span class="text-slate-600">Amount</span>
                                    <input
                                        v-model="utilForm.amount"
                                        type="number"
                                        min="0"
                                        step="any"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                        placeholder="0"
                                    />
                                </label>
                                <label class="block text-sm">
                                    <span class="text-slate-600">Year</span>
                                    <input
                                        v-model.number="utilForm.year"
                                        type="number"
                                        min="2000"
                                        max="2100"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                        @change="onUtilPeriodChange"
                                    />
                                </label>
                                <label class="block text-sm">
                                    <span class="text-slate-600">Month</span>
                                    <select
                                        v-model.number="utilForm.month"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                        @change="onUtilPeriodChange"
                                    >
                                        <option
                                            v-for="m in 12"
                                            :key="m"
                                            :value="m"
                                        >
                                            {{ m }}
                                        </option>
                                    </select>
                                </label>
                                <label class="block text-sm sm:col-span-2">
                                    <span class="text-slate-600">Due date</span>
                                    <input
                                        v-model="utilForm.dueDate"
                                        type="date"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                    />
                                </label>
                            </div>
                            <div class="mt-4 flex justify-end">
                                <button
                                    type="button"
                                    class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    :disabled="utilSaving || !canSaveUtility"
                                    @click="saveUtilityBill"
                                >
                                    {{ utilSaving ? 'Saving…' : 'Save charge' }}
                                </button>
                            </div>
                        </div>
                        <p v-else class="mt-4 text-sm text-amber-800">
                            This unit has no metered electricity or water
                            configured. Set rates under Property → Units first.
                        </p>

                        <div class="mt-6 flex justify-end">
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2 text-sm text-slate-600"
                                @click="showUtilities = false"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
        </template>
    </div>
</template>
