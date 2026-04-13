<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../lib/api';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';
import type { Paginated, Property, Unit } from '../../types/models';

type SignupRow = {
    id: string;
    status: string;
    createdAt: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        phone: string | null;
        createdAt: string;
    };
};

const route = useRoute();
const { orgApi } = usePlatformOrgContext();

const signups = ref<SignupRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const actionError = ref<string | null>(null);
const unitOptions = ref<{ id: string; label: string; propertyName: string }[]>(
    [],
);
const showApprove = ref<SignupRow | null>(null);
const approveForm = ref({
    unitId: '',
    startDate: new Date().toISOString().slice(0, 10),
    rentAmount: '',
    dueDay: '1',
    currency: 'XAF',
    prepaidMonths: '0',
});
const approveSaving = ref(false);

async function loadSignups() {
    loading.value = true;
    error.value = null;
    try {
        signups.value = await api<SignupRow[]>(orgApi('/tenant-signups'));
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
    } finally {
        loading.value = false;
    }
}

async function loadUnitsForApprove() {
    const propsRes = await api<Paginated<Property>>(
        orgApi('/properties?limit=100'),
    );
    const pairs: { id: string; label: string; propertyName: string }[] = [];
    for (const p of propsRes.items) {
        const unitsRes = await api<Paginated<Unit>>(
            orgApi(`/properties/${p.id}/units?limit=500`),
        );
        for (const u of unitsRes.items) {
            pairs.push({ id: u.id, label: u.label, propertyName: p.name });
        }
    }
    unitOptions.value = pairs;
}

function openApprove(row: SignupRow) {
    actionError.value = null;
    approveForm.value = {
        unitId: '',
        startDate: new Date().toISOString().slice(0, 10),
        rentAmount: '',
        dueDay: '1',
        currency: 'XAF',
        prepaidMonths: '0',
    };
    showApprove.value = row;
    void loadUnitsForApprove();
}

async function submitApprove() {
    const row = showApprove.value;
    if (!row) return;
    const rent = Number.parseFloat(approveForm.value.rentAmount);
    if (!approveForm.value.unitId || Number.isNaN(rent)) {
        actionError.value = 'Choose a unit and enter rent.';
        return;
    }
    approveSaving.value = true;
    actionError.value = null;
    try {
        const prepaid = Number.parseInt(approveForm.value.prepaidMonths, 10);
        await api(orgApi(`/tenant-signups/${row.id}/approve`), {
            method: 'POST',
            body: JSON.stringify({
                unitId: approveForm.value.unitId,
                startDate: new Date(approveForm.value.startDate).toISOString(),
                rentAmount: rent,
                dueDay: Number.parseInt(approveForm.value.dueDay, 10) || 1,
                currency: approveForm.value.currency.trim() || 'XAF',
                prepaidMonths: Number.isNaN(prepaid)
                    ? 0
                    : Math.min(60, Math.max(0, prepaid)),
            }),
        });
        showApprove.value = null;
        await loadSignups();
    } catch (e) {
        actionError.value = e instanceof Error ? e.message : 'Approve failed';
    } finally {
        approveSaving.value = false;
    }
}

async function rejectSignup(row: SignupRow) {
    if (!confirm(`Reject signup for ${row.user.email}?`)) return;
    actionError.value = null;
    try {
        await api(orgApi(`/tenant-signups/${row.id}/reject`), {
            method: 'POST',
        });
        await loadSignups();
    } catch (e) {
        actionError.value = e instanceof Error ? e.message : 'Reject failed';
    }
}

onMounted(() => void loadSignups());
watch(
    () => route.params.orgId,
    () => void loadSignups(),
);
</script>

<template>
    <div>
        <p class="text-sm text-slate-600">
            Pending self-serve tenant registrations. Approve by assigning a unit
            and lease terms.
        </p>
        <p v-if="error" class="mt-4 text-sm text-red-600">{{ error }}</p>
        <p v-if="actionError" class="mt-2 text-sm text-red-600">
            {{ actionError }}
        </p>
        <div v-if="loading" class="mt-4 text-sm text-slate-500">Loading…</div>
        <div
            v-else-if="!signups.length"
            class="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600"
        >
            No pending signups.
        </div>
        <ul v-else class="mt-6 space-y-3">
            <li
                v-for="row in signups"
                :key="row.id"
                class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
                <div>
                    <p class="font-medium text-slate-900">
                        {{ row.user.email }}
                    </p>
                    <p class="text-xs text-slate-500">
                        {{ row.user.name || '—' }} · requested
                        {{ new Date(row.createdAt).toLocaleString() }}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                        @click="openApprove(row)"
                    >
                        Approve
                    </button>
                    <button
                        type="button"
                        class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        @click="rejectSignup(row)"
                    >
                        Reject
                    </button>
                </div>
            </li>
        </ul>

        <div
            v-if="showApprove"
            class="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            @click.self="showApprove = null"
        >
            <div
                class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
                <h3 class="text-lg font-semibold text-slate-900">
                    Approve signup
                </h3>
                <p class="mt-1 text-sm text-slate-600">
                    {{ showApprove?.user.email }}
                </p>
                <form class="mt-4 space-y-3" @submit.prevent="submitApprove">
                    <label class="block text-sm">
                        <span class="text-slate-700">Unit</span>
                        <select
                            v-model="approveForm.unitId"
                            required
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        >
                            <option disabled value="">Select unit…</option>
                            <option
                                v-for="u in unitOptions"
                                :key="u.id"
                                :value="u.id"
                            >
                                {{ u.propertyName }} — {{ u.label }}
                            </option>
                        </select>
                    </label>
                    <label class="block text-sm">
                        <span class="text-slate-700">Start date</span>
                        <input
                            v-model="approveForm.startDate"
                            type="date"
                            required
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label class="block text-sm">
                        <span class="text-slate-700">Monthly rent</span>
                        <input
                            v-model="approveForm.rentAmount"
                            type="number"
                            step="any"
                            required
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <div class="grid grid-cols-2 gap-3">
                        <label class="block text-sm">
                            <span class="text-slate-700">Due day</span>
                            <input
                                v-model="approveForm.dueDay"
                                type="number"
                                min="1"
                                max="28"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>
                        <label class="block text-sm">
                            <span class="text-slate-700">Currency</span>
                            <input
                                v-model="approveForm.currency"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>
                    </div>
                    <label class="block text-sm">
                        <span class="text-slate-700"
                            >Prepaid months (0–60)</span
                        >
                        <input
                            v-model="approveForm.prepaidMonths"
                            type="number"
                            min="0"
                            max="60"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <div class="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold"
                            @click="showApprove = null"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                            :disabled="approveSaving"
                        >
                            {{ approveSaving ? 'Saving…' : 'Approve' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
