<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import { formatDate, formatMoney } from '../composables/format';
import type { Lease, Property, Renter, Unit } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();

const leases = ref<Lease[]>([]);
const unitOptions = ref<{ id: string; label: string; propertyName: string }[]>([]);
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
});
const saving = ref(false);

async function loadUnitsAndRenters() {
  if (!hasOrg.value) return;
  const props = await api<Property[]>(orgApi('/properties'));
  const pairs: { id: string; label: string; propertyName: string }[] = [];
  for (const p of props) {
    const units = await api<Unit[]>(orgApi(`/properties/${p.id}/units`));
    for (const u of units) {
      pairs.push({
        id: u.id,
        label: u.label,
        propertyName: p.name,
      });
    }
  }
  unitOptions.value = pairs;
  renters.value = await api<Renter[]>(orgApi('/renters'));
}

async function load() {
  if (!hasOrg.value) return;
  loading.value = true;
  error.value = null;
  try {
    await loadUnitsAndRenters();
    leases.value = await api<Lease[]>(orgApi('/leases'));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function createLease() {
  const unitId = form.value.unitId;
  const renterId = form.value.renterId;
  const rent = Number.parseFloat(form.value.rentAmount);
  if (!unitId || !renterId || Number.isNaN(rent)) return;
  saving.value = true;
  try {
    await api(orgApi('/leases'), {
      method: 'POST',
      body: JSON.stringify({
        unitId,
        renterId,
        startDate: new Date(form.value.startDate).toISOString(),
        rentAmount: rent,
        dueDay: Number.parseInt(form.value.dueDay, 10) || 1,
      }),
    });
    showAdd.value = false;
    form.value = {
      unitId: '',
      renterId: '',
      startDate: new Date().toISOString().slice(0, 10),
      rentAmount: '',
      dueDay: '1',
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
</script>

<template>
  <div>
    <SelectOrgPrompt v-if="!hasOrg" />

    <template v-else>
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-600">Agreements between renters and units.</p>
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

      <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div class="overflow-x-auto">
          <table class="min-w-[640px] w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              <tr v-for="l in leases" :key="l.id" class="hover:bg-slate-50/80">
                <td class="px-4 py-3 font-medium text-slate-900">{{ l.renter.fullName }}</td>
                <td class="px-4 py-3 text-slate-600">
                  {{ l.unit.label }}
                  <span class="block text-xs text-slate-400">{{ l.unit.property.name }}</span>
                </td>
                <td class="px-4 py-3 tabular-nums">{{ formatMoney(l.rentAmount, l.currency) }}</td>
                <td class="px-4 py-3 text-slate-600">{{ formatDate(l.startDate) }}</td>
                <td class="px-4 py-3">{{ l.dueDay }}</td>
                <td class="px-4 py-3 text-right">
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
        <p v-if="!leases.length" class="px-4 py-10 text-center text-sm text-slate-500">No leases yet.</p>
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
            <p class="mt-1 text-sm text-slate-500">Links a renter to a unit. The unit must be vacant.</p>

            <label class="mt-4 block">
              <span class="text-sm font-medium">Unit</span>
              <select
                v-model="form.unitId"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              >
                <option value="" disabled>Select unit</option>
                <option v-for="o in unitOptions" :key="o.id" :value="o.id">
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
                <option v-for="r in renters" :key="r.id" :value="r.id">{{ r.fullName }}</option>
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
              <span class="text-sm font-medium">Monthly rent</span>
              <input
                v-model="form.rentAmount"
                type="number"
                min="0"
                step="1"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>

            <label class="mt-3 block">
              <span class="text-sm font-medium">Rent due day of month (1–28)</span>
              <input
                v-model="form.dueDay"
                type="number"
                min="1"
                max="28"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>

            <div class="mt-6 flex justify-end gap-2">
              <button type="button" class="rounded-xl px-4 py-2 text-sm text-slate-600" @click="showAdd = false">
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
    </template>
  </div>
</template>
