<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../lib/api';
import { formatDate, formatMoney } from '../../composables/format';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';
import type { Lease, Paginated, Property, Renter, Unit } from '../../types/models';

const route = useRoute();
const { orgApi } = usePlatformOrgContext();

const leases = ref<Lease[]>([]);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
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
  prepaidMonths: '0',
});
const saving = ref(false);

async function loadUnitsAndRenters() {
  const propsRes = await api<Paginated<Property>>(orgApi('/properties?limit=500'));
  const pairs: { id: string; label: string; propertyName: string }[] = [];
  for (const p of propsRes.items) {
    const unitsRes = await api<Paginated<Unit>>(orgApi(`/properties/${p.id}/units?limit=500`));
    for (const u of unitsRes.items) {
      pairs.push({ id: u.id, label: u.label, propertyName: p.name });
    }
  }
  unitOptions.value = pairs;
  const renRes = await api<Paginated<Renter>>(orgApi('/renters?limit=500'));
  renters.value = renRes.items;
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    await loadUnitsAndRenters();
    const qs = new URLSearchParams({ page: String(page.value), limit: '20' });
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
        prepaidMonths: Number.isNaN(prepaid) ? 0 : Math.min(60, Math.max(0, prepaid)),
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
    form.value.unitId && form.value.renterId && form.value.startDate && !Number.isNaN(rent),
  );
});

onMounted(() => void load());
watch(
  () => route.params.orgId,
  () => void load(),
);
watch(page, () => void load());
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between">
      <p class="text-sm text-slate-600">Agreements between renters and units.</p>
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
        class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
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
                <button type="button" class="text-sm font-medium text-red-600 hover:underline" @click="removeLease(l)">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!leases.length" class="px-4 py-10 text-center text-sm text-slate-500">No leases yet.</p>
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
        <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" @click.stop>
          <h3 class="text-lg font-semibold">Create lease</h3>
          <label class="mt-4 block">
            <span class="text-sm font-medium">Unit</span>
            <select v-model="form.unitId" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
              <option value="" disabled>Select unit</option>
              <option v-for="o in unitOptions" :key="o.id" :value="o.id">{{ o.propertyName }} — {{ o.label }}</option>
            </select>
          </label>
          <label class="mt-3 block">
            <span class="text-sm font-medium">Renter</span>
            <select v-model="form.renterId" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
              <option value="" disabled>Select renter</option>
              <option v-for="r in renters" :key="r.id" :value="r.id">{{ r.fullName }}</option>
            </select>
          </label>
          <label class="mt-3 block">
            <span class="text-sm font-medium">Start date</span>
            <input v-model="form.startDate" type="date" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="mt-3 block">
            <span class="text-sm font-medium">Monthly rent</span>
            <input v-model="form.rentAmount" type="number" min="0" step="1" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="mt-3 block">
            <span class="text-sm font-medium">Rent due day (1–28)</span>
            <input v-model="form.dueDay" type="number" min="1" max="28" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="mt-3 block">
            <span class="text-sm font-medium">Months prepaid (0–60)</span>
            <input v-model="form.prepaidMonths" type="number" min="0" max="60" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <div class="mt-6 flex justify-end gap-2">
            <button type="button" class="rounded-xl px-4 py-2 text-sm text-slate-600" @click="showAdd = false">Cancel</button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="saving || !canSubmit"
              @click="createLease"
            >
              {{ saving ? 'Saving…' : 'Create lease' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
