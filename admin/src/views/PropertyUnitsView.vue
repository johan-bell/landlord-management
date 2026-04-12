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
const newLabel = ref('');
const newRent = ref('');
const newCurrency = ref('XAF');
const saving = ref(false);

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

async function addUnit() {
  const label = newLabel.value.trim();
  const rent = Number.parseFloat(newRent.value);
  if (!label || Number.isNaN(rent)) return;
  saving.value = true;
  try {
    await api(orgApi(`/properties/${propertyId.value}/units`), {
      method: 'POST',
      body: JSON.stringify({
        label,
        rentAmount: rent,
        currency: newCurrency.value.trim() || 'XAF',
      }),
    });
    newLabel.value = '';
    newRent.value = '';
    showAdd.value = false;
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
            @click="showAdd = true"
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
          class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          @click.self="showAdd = false"
        >
          <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" @click.stop>
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
    </template>
  </div>
</template>
