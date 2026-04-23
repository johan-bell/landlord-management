<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgElevatedAccess } from '../composables/useOrgElevatedAccess';
import { useOrgContext } from '../composables/useOrgContext';
import type { Paginated, Property, Unit } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useToastStore } from '../stores/toast';

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

const { hasOrg, orgApi, selectedOrgId } = useOrgContext();
const canDecideSignups = useOrgElevatedAccess();
const toast = useToastStore();

const rows = ref<SignupRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const unitOptions = ref<{ id: string; label: string; propertyName: string }[]>(
    [],
);

const showApprove = ref<SignupRow | null>(null);
const form = ref({
    unitId: '',
    startDate: new Date().toISOString().slice(0, 10),
    rentAmount: '',
    dueDay: '1',
    currency: 'XAF',
    prepaidMonths: '0',
});
const formError = ref<string | null>(null);
const saving = ref(false);

const confirmRejectRow = ref<SignupRow | null>(null);

async function loadSignups() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        rows.value = await api<SignupRow[]>(orgApi('/tenant-signups'));
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
    } finally {
        loading.value = false;
    }
}

async function loadUnits() {
    if (!hasOrg.value) return;
    const propsRes = await api<Paginated<Property>>(
        orgApi('/properties?limit=100'),
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
}

async function load() {
    await loadSignups();
    await loadUnits();
}

function openApprove(row: SignupRow) {
    formError.value = null;
    form.value = {
        unitId: '',
        startDate: new Date().toISOString().slice(0, 10),
        rentAmount: '',
        dueDay: '1',
        currency: 'XAF',
        prepaidMonths: '0',
    };
    showApprove.value = row;
}

async function submitApprove() {
    const row = showApprove.value;
    if (!row) return;
    const rent = Number.parseFloat(form.value.rentAmount);
    if (!form.value.unitId || Number.isNaN(rent)) {
        formError.value = 'Choose a unit and enter rent.';
        return;
    }
    saving.value = true;
    formError.value = null;
    try {
        const prepaid = Number.parseInt(form.value.prepaidMonths, 10);
        await api(orgApi(`/tenant-signups/${row.id}/approve`), {
            method: 'POST',
            body: JSON.stringify({
                unitId: form.value.unitId,
                startDate: new Date(form.value.startDate).toISOString(),
                rentAmount: rent,
                dueDay: Number.parseInt(form.value.dueDay, 10) || 1,
                currency: form.value.currency.trim() || 'XAF',
                prepaidMonths: Number.isNaN(prepaid)
                    ? 0
                    : Math.min(60, Math.max(0, prepaid)),
            }),
        });
        showApprove.value = null;
        toast.success(`${row.user.email} approved and lease created`);
        await load();
    } catch (e) {
        formError.value = e instanceof Error ? e.message : 'Approve failed';
    } finally {
        saving.value = false;
    }
}

async function doReject() {
    const row = confirmRejectRow.value;
    if (!row) return;
    try {
        await api(orgApi(`/tenant-signups/${row.id}/reject`), {
            method: 'POST',
        });
        toast.success(`Signup for ${row.user.email} rejected`);
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally {
        confirmRejectRow.value = null;
    }
}

onMounted(() => void load());
watch([hasOrg, selectedOrgId], () => void load());
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <div class="mb-6">
                <h2 class="text-xl font-semibold text-slate-900">
                    Pending tenant signups
                </h2>
                <p class="mt-1 text-sm text-slate-600">
                    People who requested access with your organization ID.
                    <template v-if="canDecideSignups">
                        Approve by assigning a unit and lease terms, or reject.
                    </template>
                    <template v-else>
                        Only
                        <strong class="font-medium text-slate-800"
                            >owners and managers</strong
                        >
                        can approve or reject; you can review the list below.
                    </template>
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

            <div
                v-else
                class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
                <table
                    class="min-w-full divide-y divide-slate-200 text-left text-sm"
                >
                    <thead
                        class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                        <tr>
                            <th class="px-4 py-3">Requested</th>
                            <th class="px-4 py-3">Name</th>
                            <th class="px-4 py-3">Email</th>
                            <th class="px-4 py-3">Phone</th>
                            <th class="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="r in rows"
                            :key="r.id"
                            class="hover:bg-slate-50/80"
                        >
                            <td
                                class="whitespace-nowrap px-4 py-3 text-slate-600"
                            >
                                {{ new Date(r.createdAt).toLocaleString() }}
                            </td>
                            <td class="px-4 py-3 font-medium text-slate-900">
                                {{ r.user.name || '—' }}
                            </td>
                            <td class="px-4 py-3 text-slate-700">
                                {{ r.user.email }}
                            </td>
                            <td class="px-4 py-3 text-slate-600">
                                {{ r.user.phone || '—' }}
                            </td>
                            <td class="px-4 py-3 text-right">
                                <template v-if="canDecideSignups">
                                    <button
                                        type="button"
                                        class="mr-3 text-sm font-medium text-emerald-700 hover:underline"
                                        @click="openApprove(r)"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        type="button"
                                        class="text-sm font-medium text-red-600 hover:underline"
                                        @click="confirmRejectRow = r"
                                    >
                                        Reject
                                    </button>
                                </template>
                                <span v-else class="text-xs text-slate-400"
                                    >—</span
                                >
                            </td>
                        </tr>
                    </tbody>
                </table>
                <p
                    v-if="!rows.length"
                    class="px-4 py-10 text-center text-sm text-slate-500"
                >
                    No pending signups.
                </p>
            </div>

            <Teleport to="body">
                <div
                    v-if="showApprove"
                    class="fixed inset-0 z-100 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
                    @click.self="showApprove = null"
                >
                    <div
                        class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        @click.stop
                    >
                        <h3 class="text-lg font-semibold">
                            Approve {{ showApprove.user.email }}
                        </h3>
                        <p class="mt-1 text-sm text-slate-600">
                            Creates their renter profile, lease, and portal
                            access.
                        </p>
                        <div class="mt-4 space-y-3">
                            <label class="block text-sm">
                                <span class="font-medium text-slate-700"
                                    >Unit</span
                                >
                                <select
                                    v-model="form.unitId"
                                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                    required
                                >
                                    <option value="" disabled>
                                        Select unit
                                    </option>
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
                                <span class="font-medium text-slate-700"
                                    >Start date</span
                                >
                                <input
                                    v-model="form.startDate"
                                    type="date"
                                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                />
                            </label>
                            <label class="block text-sm">
                                <span class="font-medium text-slate-700"
                                    >Monthly rent</span
                                >
                                <input
                                    v-model="form.rentAmount"
                                    type="number"
                                    min="0"
                                    step="1"
                                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                    placeholder="85000"
                                />
                            </label>
                            <div class="grid grid-cols-2 gap-3">
                                <label class="block text-sm">
                                    <span class="font-medium text-slate-700"
                                        >Due day</span
                                    >
                                    <input
                                        v-model="form.dueDay"
                                        type="number"
                                        min="1"
                                        max="28"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                    />
                                </label>
                                <label class="block text-sm">
                                    <span class="font-medium text-slate-700"
                                        >Currency</span
                                    >
                                    <input
                                        v-model="form.currency"
                                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                    />
                                </label>
                            </div>
                            <label class="block text-sm">
                                <span class="font-medium text-slate-700"
                                    >Months prepaid upfront (0–60)</span
                                >
                                <input
                                    v-model="form.prepaidMonths"
                                    type="number"
                                    min="0"
                                    max="60"
                                    class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                                />
                                <span class="mt-1 block text-xs text-slate-500"
                                    >Optional — marks those months as paid on
                                    the tenant portal.</span
                                >
                            </label>
                        </div>
                        <p
                            v-if="formError"
                            class="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                        >
                            {{ formError }}
                        </p>
                        <div class="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2 text-sm text-slate-600"
                                @click="showApprove = null"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                :disabled="saving"
                                @click="submitApprove"
                            >
                                {{
                                    saving
                                        ? 'Saving…'
                                        : 'Approve & create lease'
                                }}
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
        </template>

        <ConfirmDialog
            :open="!!confirmRejectRow"
            title="Reject signup"
            :message="`Reject the signup request from ${confirmRejectRow?.user.email}? They will need to request access again.`"
            confirm-label="Reject"
            danger
            @update:open="confirmRejectRow = null"
            @confirm="doReject"
        />
    </div>
</template>
