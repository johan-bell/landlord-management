<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import { formatMoney } from '../composables/format';
import type { Paginated, Property, Unit } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const route = useRoute();
const { hasOrg, orgApi } = useOrgContext();

const propertyId = computed(() => route.params.propertyId as string);

const property = ref<Property | null>(null);
const units = ref<Unit[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showAdd = ref(false);
const showEdit = ref(false);
const editingUnit = ref<Unit | null>(null);
const saving = ref(false);

const newLabel = ref('');
const newRent = ref('');
const newCurrency = ref('XAF');
const newElec = ref<'PREPAID_EXTERNAL' | 'METERED_KWH'>('PREPAID_EXTERNAL');
const newElecPrice = ref('');
const newWater = ref<'NONE' | 'METERED_M3'>('NONE');
const newWaterPrice = ref('');

const editLabel = ref('');
const editRent = ref('');
const editCurrency = ref('XAF');
const editElec = ref<'PREPAID_EXTERNAL' | 'METERED_KWH'>('PREPAID_EXTERNAL');
const editElecPrice = ref('');
const editWater = ref<'NONE' | 'METERED_M3'>('NONE');
const editWaterPrice = ref('');

function formatRate(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n);
}

function elecSummary(u: Unit): string {
  if (u.electricityBilling === 'PREPAID_EXTERNAL') return 'Prepaid (off-app)';
  return u.electricityPricePerKwh ? `${formatRate(u.electricityPricePerKwh, u.currency)}/kWh` : '—';
}

function waterSummary(u: Unit): string {
  if (u.waterBilling === 'NONE') return '—';
  return u.waterPricePerM3 ? `${formatMoney(u.waterPricePerM3, u.currency)}/m³` : '—';
}

function utilityPayload(
  elec: 'PREPAID_EXTERNAL' | 'METERED_KWH',
  elecPrice: string,
  water: 'NONE' | 'METERED_M3',
  waterPrice: string,
) {
  const body: Record<string, unknown> = {
    electricityBilling: elec,
    waterBilling: water,
  };
  if (elec === 'METERED_KWH') {
    const n = Number.parseFloat(elecPrice);
    body.electricityPricePerKwh = Number.isNaN(n) ? null : n;
  } else {
    body.electricityPricePerKwh = null;
  }
  if (water === 'METERED_M3') {
    const n = Number.parseFloat(waterPrice);
    body.waterPricePerM3 = Number.isNaN(n) ? null : n;
  } else {
    body.waterPricePerM3 = null;
  }
  return body;
}

async function load() {
  if (!hasOrg.value || !propertyId.value) return;
  loading.value = true;
  error.value = null;
  try {
    property.value = await api<Property>(orgApi(`/properties/${propertyId.value}`));
    const ures = await api<Paginated<Unit>>(
      orgApi(`/properties/${propertyId.value}/units?limit=500`),
    );
    units.value = ures.items;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
    property.value = null;
  } finally {
    loading.value = false;
  }
}

function openAdd() {
  newLabel.value = '';
  newRent.value = '';
  newCurrency.value = 'XAF';
  newElec.value = 'PREPAID_EXTERNAL';
  newElecPrice.value = '';
  newWater.value = 'NONE';
  newWaterPrice.value = '';
  showAdd.value = true;
}

async function addUnit() {
  const label = newLabel.value.trim();
  const rent = Number.parseFloat(newRent.value);
  if (!label || Number.isNaN(rent)) return;
  if (newElec.value === 'METERED_KWH') {
    const p = Number.parseFloat(newElecPrice.value);
    if (Number.isNaN(p) || p <= 0) {
      error.value = 'Enter a price per kWh for metered electricity.';
      return;
    }
  }
  if (newWater.value === 'METERED_M3') {
    const p = Number.parseFloat(newWaterPrice.value);
    if (Number.isNaN(p) || p <= 0) {
      error.value = 'Enter a price per m³ for metered water.';
      return;
    }
  }
  saving.value = true;
  error.value = null;
  try {
    await api(orgApi(`/properties/${propertyId.value}/units`), {
      method: 'POST',
      body: JSON.stringify({
        label,
        rentAmount: rent,
        currency: newCurrency.value.trim() || 'XAF',
        ...utilityPayload(newElec.value, newElecPrice.value, newWater.value, newWaterPrice.value),
      }),
    });
    showAdd.value = false;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Save failed';
  } finally {
    saving.value = false;
  }
}

function openEdit(u: Unit) {
  editingUnit.value = u;
  editLabel.value = u.label;
  editRent.value = String(Number.parseFloat(u.rentAmount));
  editCurrency.value = u.currency;
  editElec.value = u.electricityBilling;
  editElecPrice.value = u.electricityPricePerKwh ?? '';
  editWater.value = u.waterBilling;
  editWaterPrice.value = u.waterPricePerM3 ?? '';
  showEdit.value = true;
}

async function saveEdit() {
  if (!editingUnit.value) return;
  const label = editLabel.value.trim();
  const rent = Number.parseFloat(editRent.value);
  if (!label || Number.isNaN(rent)) return;
  if (editElec.value === 'METERED_KWH') {
    const p = Number.parseFloat(editElecPrice.value);
    if (Number.isNaN(p) || p <= 0) {
      error.value = 'Enter a price per kWh for metered electricity.';
      return;
    }
  }
  if (editWater.value === 'METERED_M3') {
    const p = Number.parseFloat(editWaterPrice.value);
    if (Number.isNaN(p) || p <= 0) {
      error.value = 'Enter a price per m³ for metered water.';
      return;
    }
  }
  saving.value = true;
  error.value = null;
  try {
    await api(orgApi(`/properties/${propertyId.value}/units/${editingUnit.value.id}`), {
      method: 'PATCH',
      body: JSON.stringify({
        label,
        rentAmount: rent,
        currency: editCurrency.value.trim() || 'XAF',
        ...utilityPayload(editElec.value, editElecPrice.value, editWater.value, editWaterPrice.value),
      }),
    });
    showEdit.value = false;
    editingUnit.value = null;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Save failed';
  } finally {
    saving.value = false;
  }
}

async function removeUnit(u: Unit) {
  if (!confirm(`Remove unit “${u.label}”?`)) return;
  try {
    await api(orgApi(`/properties/${propertyId.value}/units/${u.id}`), { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Delete failed';
  }
}

onMounted(() => {
  void load();
});

watch([hasOrg, propertyId], () => {
  void load();
});
</script>

<template>
  <div>
    <SelectOrgPrompt v-if="!hasOrg" />

    <template v-else>
      <div class="mb-6">
        <RouterLink
          to="/properties"
          class="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-emerald-700"
        >
          ← Back to properties
        </RouterLink>
        <h2 v-if="property" class="mt-2 text-xl font-semibold text-slate-900">
          {{ property.name }}
        </h2>
        <p v-if="property?.address" class="text-sm text-slate-500">{{ property.address }}</p>
      </div>

      <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

      <div
        v-if="loading"
        class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
      >
        Loading…
      </div>

      <template v-else-if="property">
        <div class="mb-4 flex justify-end">
          <button
            type="button"
            class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            @click="openAdd"
          >
            Add unit
          </button>
        </div>

        <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-4 py-3">Unit</th>
                <th class="px-4 py-3">Rent</th>
                <th class="hidden px-4 py-3 lg:table-cell">Electricity</th>
                <th class="hidden px-4 py-3 md:table-cell">Water</th>
                <th class="px-4 py-3">Status</th>
                <th class="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="u in units" :key="u.id" class="hover:bg-slate-50/80">
                <td class="px-4 py-3 font-medium text-slate-900">{{ u.label }}</td>
                <td class="px-4 py-3 tabular-nums text-slate-700">
                  {{ formatMoney(u.rentAmount, u.currency) }}
                </td>
                <td class="hidden max-w-[10rem] truncate px-4 py-3 text-xs text-slate-600 lg:table-cell">
                  {{ elecSummary(u) }}
                </td>
                <td class="hidden px-4 py-3 text-xs text-slate-600 md:table-cell">
                  {{ waterSummary(u) }}
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      u.status === 'OCCUPIED'
                        ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
                    ]"
                  >
                    {{ u.status === 'OCCUPIED' ? 'Occupied' : 'Vacant' }}
                  </span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="mr-3 text-sm font-medium text-emerald-700 hover:underline"
                    @click="openEdit(u)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="text-sm font-medium text-red-600 hover:underline"
                    @click="removeUnit(u)"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-if="!units.length" class="px-4 py-10 text-center text-sm text-slate-500">
            No units yet. Add apartments or rooms here.
          </p>
        </div>
      </template>

      <Teleport to="body">
        <div
          v-if="showAdd"
          class="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
          @click.self="showAdd = false"
        >
          <div
            class="my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            @click.stop
          >
            <h3 class="text-lg font-semibold">New unit</h3>
            <label class="mt-4 block">
              <span class="text-sm font-medium text-slate-700">Label</span>
              <input
                v-model="newLabel"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="Apartment A1"
              />
            </label>
            <label class="mt-3 block">
              <span class="text-sm font-medium text-slate-700">Monthly rent</span>
              <input
                v-model="newRent"
                type="number"
                min="0"
                step="1"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                placeholder="85000"
              />
            </label>
            <label class="mt-3 block">
              <span class="text-sm font-medium text-slate-700">Currency</span>
              <input v-model="newCurrency" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>

            <div class="mt-5 border-t border-slate-100 pt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Electricity</p>
              <p class="mt-1 text-xs text-slate-500">
                Prepaid meters are managed outside this app. Choose metered only if you bill by consumption (per kWh).
              </p>
              <select
                v-model="newElec"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="PREPAID_EXTERNAL">Prepaid / not tracked here</option>
                <option value="METERED_KWH">Metered — price per kWh</option>
              </select>
              <label v-if="newElec === 'METERED_KWH'" class="mt-2 block">
                <span class="text-sm font-medium text-slate-700">Price per kWh</span>
                <input
                  v-model="newElecPrice"
                  type="number"
                  min="0"
                  step="any"
                  class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="0"
                />
              </label>
            </div>

            <div class="mt-5 border-t border-slate-100 pt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Water</p>
              <select
                v-model="newWater"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="NONE">Not billed in app</option>
                <option value="METERED_M3">Metered — price per m³</option>
              </select>
              <label v-if="newWater === 'METERED_M3'" class="mt-2 block">
                <span class="text-sm font-medium text-slate-700">Price per m³</span>
                <input
                  v-model="newWaterPrice"
                  type="number"
                  min="0"
                  step="any"
                  class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                  placeholder="0"
                />
              </label>
            </div>

            <div class="mt-6 flex justify-end gap-2">
              <button type="button" class="rounded-xl px-4 py-2 text-sm text-slate-600" @click="showAdd = false">
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="saving || !newLabel.trim() || !newRent"
                @click="addUnit"
              >
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>

      <Teleport to="body">
        <div
          v-if="showEdit && editingUnit"
          class="fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-900/50 p-4 sm:items-center"
          @click.self="showEdit = false"
        >
          <div
            class="my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            @click.stop
          >
            <h3 class="text-lg font-semibold">Edit unit</h3>
            <label class="mt-4 block">
              <span class="text-sm font-medium text-slate-700">Label</span>
              <input
                v-model="editLabel"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label class="mt-3 block">
              <span class="text-sm font-medium text-slate-700">Monthly rent</span>
              <input
                v-model="editRent"
                type="number"
                min="0"
                step="1"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <label class="mt-3 block">
              <span class="text-sm font-medium text-slate-700">Currency</span>
              <input v-model="editCurrency" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>

            <div class="mt-5 border-t border-slate-100 pt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Electricity</p>
              <p class="mt-1 text-xs text-slate-500">
                Prepaid meters are managed outside this app. Metered = bill per kWh from readings.
              </p>
              <select
                v-model="editElec"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="PREPAID_EXTERNAL">Prepaid / not tracked here</option>
                <option value="METERED_KWH">Metered — price per kWh</option>
              </select>
              <label v-if="editElec === 'METERED_KWH'" class="mt-2 block">
                <span class="text-sm font-medium text-slate-700">Price per kWh</span>
                <input
                  v-model="editElecPrice"
                  type="number"
                  min="0"
                  step="any"
                  class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
            </div>

            <div class="mt-5 border-t border-slate-100 pt-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Water</p>
              <select
                v-model="editWater"
                class="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="NONE">Not billed in app</option>
                <option value="METERED_M3">Metered — price per m³</option>
              </select>
              <label v-if="editWater === 'METERED_M3'" class="mt-2 block">
                <span class="text-sm font-medium text-slate-700">Price per m³</span>
                <input
                  v-model="editWaterPrice"
                  type="number"
                  min="0"
                  step="any"
                  class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
            </div>

            <div class="mt-6 flex justify-end gap-2">
              <button type="button" class="rounded-xl px-4 py-2 text-sm text-slate-600" @click="showEdit = false">
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="saving || !editLabel.trim() || !editRent"
                @click="saveEdit"
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
