<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import { formatMoney } from '../composables/format';
import type { Paginated, Property, Unit } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();

const rows = ref<(Property & { units?: Unit[] })[]>([]);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const showAdd = ref(false);
const newName = ref('');
const newAddress = ref('');
const saving = ref(false);

const PAGE_SIZE = 12;

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
    const data = await api<Paginated<Property>>(`${orgApi('/properties')}?${qs}`);
    totalPages.value = Math.max(1, data.totalPages);
    const withUnits = await Promise.all(
      data.items.map(async (p) => {
        const ures = await api<Paginated<Unit>>(
          `${orgApi(`/properties/${p.id}/units`)}?limit=100`,
        );
        return { ...p, units: ures.items };
      }),
    );
    rows.value = withUnits;
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

async function addProperty() {
  const name = newName.value.trim();
  if (!name) return;
  saving.value = true;
  try {
    await api(orgApi('/properties'), {
      method: 'POST',
      body: JSON.stringify({
        name,
        address: newAddress.value.trim() || undefined,
      }),
    });
    newName.value = '';
    newAddress.value = '';
    showAdd.value = false;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Save failed';
  } finally {
    saving.value = false;
  }
}

async function removeProperty(p: Property) {
  if (!confirm(`Delete “${p.name}” and all its units? This cannot be undone.`)) return;
  try {
    await api(orgApi(`/properties/${p.id}`), { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Delete failed';
  }
}

onMounted(() => {
  void load();
});

watch(hasOrg, () => {
  void load();
});

watch(page, () => {
  void load();
});
</script>

<template>
  <div>
    <SelectOrgPrompt v-if="!hasOrg" />

    <template v-else>
      <div class="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <p class="text-sm text-slate-600">
          Buildings and sites in this organization. Open a property to manage units and rent amounts.
        </p>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="search"
            type="search"
            placeholder="Search name or address…"
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
          class="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          @click="showAdd = true"
        >
          Add property
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

      <div
        v-if="loading"
        class="flex justify-center rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-500"
      >
        Loading properties…
      </div>

      <div v-else-if="!rows.length" class="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
        <p class="text-slate-600">No properties yet.</p>
        <button
          type="button"
          class="mt-3 text-sm font-semibold text-emerald-600 hover:text-emerald-700"
          @click="showAdd = true"
        >
          Add your first property
        </button>
      </div>

      <div v-else class="grid gap-4 lg:grid-cols-2">
        <article
          v-for="p in rows"
          :key="p.id"
          class="group flex flex-col rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:border-emerald-200 hover:shadow-md"
        >
          <div class="flex flex-1 flex-col p-5">
            <div class="flex items-start justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-slate-900">{{ p.name }}</h3>
                <p v-if="p.address" class="mt-1 text-sm text-slate-500">{{ p.address }}</p>
              </div>
              <span
                class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
              >
                {{ p.units?.length ?? 0 }} units
              </span>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <RouterLink
                :to="`/properties/${p.id}/units`"
                class="inline-flex items-center rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200/80 transition hover:bg-emerald-100"
              >
                Manage units
              </RouterLink>
              <button
                type="button"
                class="text-sm font-medium text-slate-500 underline-offset-2 hover:text-red-600 hover:underline"
                @click="removeProperty(p)"
              >
                Delete
              </button>
            </div>
          </div>
          <div
            v-if="p.units?.length"
            class="border-t border-slate-100 bg-slate-50/80 px-5 py-3"
          >
            <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Sample units</p>
            <ul class="mt-2 space-y-1">
              <li
                v-for="u in p.units!.slice(0, 3)"
                :key="u.id"
                class="flex justify-between text-sm text-slate-600"
              >
                <span>{{ u.label }}</span>
                <span class="tabular-nums text-slate-900">{{ formatMoney(u.rentAmount, u.currency) }}</span>
              </li>
              <li v-if="(p.units?.length ?? 0) > 3" class="text-xs text-slate-400">
                + {{ (p.units?.length ?? 0) - 3 }} more
              </li>
            </ul>
          </div>
        </article>
      </div>

      <div
        v-if="!loading && totalPages > 1"
        class="mt-8 flex items-center justify-center gap-4 text-sm text-slate-600"
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
          class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          @click.self="showAdd = false"
        >
          <div
            class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
            @click.stop
          >
            <h3 class="text-lg font-semibold text-slate-900">New property</h3>
            <p class="mt-1 text-sm text-slate-500">A building or site that contains rentable units.</p>
            <label class="mt-4 block">
              <span class="text-sm font-medium text-slate-700">Name</span>
              <input
                v-model="newName"
                type="text"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Résidence Akwa"
              />
            </label>
            <label class="mt-3 block">
              <span class="text-sm font-medium text-slate-700">Address (optional)</span>
              <input
                v-model="newAddress"
                type="text"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="City, region"
              />
            </label>
            <div class="mt-6 flex justify-end gap-2">
              <button
                type="button"
                class="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                @click="showAdd = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                :disabled="saving || !newName.trim()"
                @click="addProperty"
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
