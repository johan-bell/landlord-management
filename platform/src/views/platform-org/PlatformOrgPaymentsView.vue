<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../lib/api';
import {
  formatDate,
  formatDateTime,
  formatMoney,
} from '../../composables/format';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';
import type { Lease, Paginated, Payment } from '../../types/models';

const route = useRoute();
const { orgApi } = usePlatformOrgContext();

const leases = ref<Lease[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

type Row = Payment & {
  renterName: string;
  unitLabel: string;
  propertyName: string;
};

const rows = computed<Row[]>(() => {
  const out: Row[] = [];
  for (const lease of leases.value) {
    for (const p of lease.payments ?? []) {
      out.push({
        ...p,
        renterName: lease.renter.fullName,
        unitLabel: lease.unit.label,
        propertyName: lease.unit.property.name,
      });
    }
  }
  return out.sort(
    (a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
  );
});

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api<Paginated<Lease>>(orgApi('/leases?limit=500'));
    leases.value = res.items as Lease[];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function markPaid(row: Row) {
  try {
    await api(orgApi(`/leases/${row.leaseId}/payments/${row.id}`), {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'PAID',
        paidAt: new Date().toISOString(),
        method: 'CASH',
      }),
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Update failed';
  }
}

function statusClass(s: Payment['status']) {
  if (s === 'PAID') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
  if (s === 'LATE') return 'bg-red-50 text-red-800 ring-red-200';
  return 'bg-amber-50 text-amber-800 ring-amber-200';
}

onMounted(() => void load());
watch(
  () => route.params.orgId,
  () => void load(),
);
</script>

<template>
  <div>
    <p class="mb-6 text-sm text-slate-600">
      Rent charges across leases. Mark a row as paid to record collection.
    </p>

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
          class="min-w-[720px] w-full divide-y divide-slate-200 text-left text-sm"
        >
          <thead
            class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            <tr>
              <th class="px-4 py-3">Due</th>
              <th class="px-4 py-3">Amount</th>
              <th class="px-4 py-3">Renter</th>
              <th class="px-4 py-3">Unit</th>
              <th class="px-4 py-3">Status</th>
              <th class="px-4 py-3">Paid at</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in rows" :key="row.id" class="hover:bg-slate-50/80">
              <td class="px-4 py-3 text-slate-700">
                {{ formatDate(row.dueDate) }}
              </td>
              <td class="px-4 py-3 font-medium tabular-nums text-slate-900">
                {{ formatMoney(row.amount, row.currency) }}
              </td>
              <td class="px-4 py-3">{{ row.renterName }}</td>
              <td class="px-4 py-3 text-slate-600">
                {{ row.unitLabel }}
                <span class="block text-xs text-slate-400">{{
                  row.propertyName
                }}</span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                  :class="statusClass(row.status)"
                >
                  {{ row.status }}
                </span>
              </td>
              <td class="px-4 py-3 text-xs text-slate-500">
                {{ formatDateTime(row.paidAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  v-if="row.status !== 'PAID'"
                  type="button"
                  class="text-sm font-semibold text-indigo-600 hover:underline"
                  @click="markPaid(row)"
                >
                  Mark paid
                </button>
                <span v-else class="text-xs text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="!rows.length"
        class="px-4 py-10 text-center text-sm text-slate-500"
      >
        No payment records.
      </p>
    </div>
  </div>
</template>
