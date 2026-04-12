<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgStore } from '../stores/org';
import type { OrgSummary } from '../types/models';
import { formatMoney } from '../composables/format';

const orgStore = useOrgStore();
const newOrgName = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const summary = ref<OrgSummary | null>(null);
const summaryLoading = ref(false);

const selectedId = computed(() => orgStore.selectedOrgId);

async function loadSummary() {
  const id = orgStore.selectedOrgId;
  if (!id) {
    summary.value = null;
    return;
  }
  summaryLoading.value = true;
  try {
    summary.value = await api<OrgSummary>(`/organizations/${id}/summary`);
  } catch {
    summary.value = null;
  } finally {
    summaryLoading.value = false;
  }
}

async function createOrg() {
  const name = newOrgName.value.trim();
  if (!name) return;
  submitting.value = true;
  error.value = null;
  try {
    const created = await api<{ id: string }>('/organizations', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    newOrgName.value = '';
    await orgStore.fetchOrganizations();
    orgStore.setOrg(created.id);
    await loadSummary();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not create organization';
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  void loadSummary();
});

watch(
  () => orgStore.selectedOrgId,
  () => {
    void loadSummary();
  },
);

const statCards = computed(() => {
  if (!summary.value) return [];
  const s = summary.value;
  return [
    {
      label: 'Properties',
      value: s.propertyCount,
      hint: 'Buildings & sites',
      tone: 'from-violet-500 to-purple-600',
    },
    {
      label: 'Units',
      value: s.unitCount,
      hint: `${s.occupiedUnitCount} occupied · ${s.vacantUnitCount} vacant`,
      tone: 'from-emerald-500 to-teal-600',
    },
    {
      label: 'Renters',
      value: s.renterCount,
      hint: 'Active profiles',
      tone: 'from-sky-500 to-blue-600',
    },
    {
      label: 'Leases',
      value: s.leaseCount,
      hint: 'Recorded agreements',
      tone: 'from-amber-500 to-orange-600',
    },
  ];
});
</script>

<template>
  <div class="space-y-8">
    <section
      class="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
    >
      <div
        class="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-6 py-5 sm:px-8"
      >
        <h2 class="text-base font-semibold text-slate-900">Create organization</h2>
        <p class="mt-1 text-sm text-slate-600">
          Each organization is an isolated portfolio (your SaaS tenant). Add one for each landlord or agency you manage.
        </p>
      </div>
      <form class="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:px-8 sm:pb-8" @submit.prevent="createOrg">
        <label class="min-w-0 flex-1">
          <span class="mb-1.5 block text-sm font-medium text-slate-700">Organization name</span>
          <input
            v-model="newOrgName"
            type="text"
            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 shadow-inner transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            placeholder="e.g. Douala Rentals"
            autocomplete="organization"
          />
        </label>
        <button
          type="submit"
          class="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/10 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="submitting || !newOrgName.trim()"
        >
          {{ submitting ? 'Creating…' : 'Create' }}
        </button>
      </form>
      <p v-if="error" class="px-6 pb-4 text-sm text-red-600 sm:px-8">{{ error }}</p>
    </section>

    <section v-if="!selectedId" class="rounded-2xl border border-amber-200/80 bg-amber-50/50 px-6 py-8 text-center sm:px-8">
      <p class="text-sm font-medium text-amber-900">Select an organization above</p>
      <p class="mt-1 text-sm text-amber-800/90">
        Overview metrics appear after you pick a portfolio from the header menu.
      </p>
    </section>

    <section v-else>
      <div class="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Portfolio snapshot</h2>
          <p class="text-xs text-slate-500">Live counts for the selected organization</p>
        </div>
        <span v-if="summaryLoading" class="text-xs text-slate-400">Updating…</span>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article
          v-for="card in statCards"
          :key="card.label"
          class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md"
        >
          <div
            :class="[
              'absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-2xl transition group-hover:opacity-20 bg-gradient-to-br',
              card.tone,
            ]"
          />
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ card.label }}</p>
          <p class="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900">{{ card.value }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ card.hint }}</p>
        </article>
      </div>

      <div
        v-if="summary && summary.unitCount > 0"
        class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <h3 class="text-sm font-semibold text-slate-900">Occupancy</h3>
        <div class="mt-4 flex items-center gap-3">
          <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
              :style="{
                width: `${summary.unitCount ? Math.round((summary.occupiedUnitCount / summary.unitCount) * 100) : 0}%`,
              }"
            />
          </div>
          <span class="text-sm font-medium tabular-nums text-slate-700">
            {{
              summary.unitCount
                ? Math.round((summary.occupiedUnitCount / summary.unitCount) * 100)
                : 0
            }}%
          </span>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          Portfolio load — {{ summary.occupiedUnitCount }} of {{ summary.unitCount }} units occupied.
        </p>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-200 bg-slate-900 px-6 py-8 text-slate-300 sm:px-8">
      <h3 class="text-sm font-semibold text-white">Revenue placeholder</h3>
      <p class="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">
        When you connect payment providers, this panel can show collected rent (e.g.
        {{ formatMoney(0, 'XAF') }} this month). For now it keeps the layout ready for charts and KPIs.
      </p>
    </section>
  </div>
</template>
