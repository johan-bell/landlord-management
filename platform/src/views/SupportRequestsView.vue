<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import { api } from '../lib/api';

type SupportRow = {
  id: string;
  subject: string;
  message: string;
  status: string;
  fromTenant: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  resolutionNote: string | null;
  submitter: { id: string; email: string | null; name: string | null };
  organization: { id: string; name: string } | null;
  handledBy: { id: string; email: string | null; name: string | null } | null;
};

const route = useRoute();

const loading = ref(true);
const savingId = ref<string | null>(null);
const error = ref<string | null>(null);
const rows = ref<SupportRow[]>([]);

const filterStatus = ref<string>('');
const filterOrgId = ref('');

const detail = ref<SupportRow | null>(null);
const editStatus = ref('');
const editNote = ref('');

const statusOptions = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

function syncFiltersFromRoute() {
  const q = route.query.organizationId;
  filterOrgId.value = typeof q === 'string' ? q : '';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const params = new URLSearchParams();
    if (filterStatus.value) params.set('status', filterStatus.value);
    if (filterOrgId.value.trim()) params.set('organizationId', filterOrgId.value.trim());
    const q = params.toString();
    rows.value = await api<SupportRow[]>(`/platform/support-requests${q ? `?${q}` : ''}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function openDetail(row: SupportRow) {
  detail.value = row;
  editStatus.value = row.status;
  editNote.value = row.resolutionNote ?? '';
}

function closeDetail() {
  detail.value = null;
}

async function saveDetail() {
  if (!detail.value) return;
  savingId.value = detail.value.id;
  error.value = null;
  try {
    await api<SupportRow>(`/platform/support-requests/${detail.value.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: editStatus.value || undefined,
        resolutionNote: editNote.value,
      }),
    });
    await load();
    const updated = rows.value.find((r) => r.id === detail.value!.id);
    detail.value = updated ?? null;
    if (detail.value) {
      editStatus.value = detail.value.status;
      editNote.value = detail.value.resolutionNote ?? '';
    } else {
      closeDetail();
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Update failed';
  } finally {
    savingId.value = null;
  }
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

onMounted(() => {
  syncFiltersFromRoute();
  void load();
});

watch(
  () => route.query.organizationId,
  () => {
    syncFiltersFromRoute();
    void load();
  },
);
</script>

<template>
  <div>
    <div class="mb-8">
      <h1 class="text-2xl font-bold tracking-tight text-slate-900">Support requests</h1>
      <p class="mt-1 text-sm text-slate-600">
        Tenant and landlord-originated tickets. Open a row to update status and add an internal note.
      </p>
    </div>

    <p v-if="error" class="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
      {{ error }}
    </p>

    <div class="mb-4 flex flex-wrap gap-3">
      <label class="flex items-center gap-2 text-sm">
        <span class="text-slate-600">Status</span>
        <select
          v-model="filterStatus"
          class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
          @change="load()"
        >
          <option v-for="s in statusOptions" :key="s || 'all'" :value="s">{{ s || 'Any' }}</option>
        </select>
      </label>
      <label class="flex min-w-[200px] flex-1 items-center gap-2 text-sm">
        <span class="text-slate-600">Organization ID</span>
        <input
          v-model="filterOrgId"
          type="text"
          placeholder="Filter by organization…"
          class="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
          @keydown.enter.prevent="load()"
        />
      </label>
      <button
        type="button"
        class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        @click="load()"
      >
        Apply
      </button>
    </div>

    <div
      v-if="loading"
      class="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-600 shadow-sm"
    >
      Loading…
    </div>

    <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Subject</th>
              <th class="hidden px-4 py-3 sm:table-cell">Organization</th>
              <th class="px-4 py-3">From</th>
              <th class="px-4 py-3">Status</th>
              <th class="hidden px-4 py-3 lg:table-cell">Created</th>
              <th class="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in rows" :key="row.id" class="hover:bg-slate-50/50">
              <td class="max-w-xs px-4 py-3">
                <p class="truncate font-medium text-slate-900">{{ row.subject }}</p>
                <p class="line-clamp-2 text-xs text-slate-500">{{ row.message }}</p>
              </td>
              <td class="hidden max-w-[160px] px-4 py-3 text-xs sm:table-cell">
                <RouterLink
                  v-if="row.organization"
                  class="font-medium text-indigo-600 hover:text-indigo-800"
                  :to="`/organization/${row.organization.id}`"
                >
                  {{ row.organization.name }}
                </RouterLink>
                <span v-else class="text-slate-400">—</span>
              </td>
              <td class="px-4 py-3 text-xs text-slate-700">
                {{ row.fromTenant ? 'Tenant' : 'Staff' }}
                <span class="block truncate text-slate-500">{{ row.submitter.email }}</span>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="
                    row.status === 'OPEN'
                      ? 'bg-blue-100 text-blue-900'
                      : row.status === 'IN_PROGRESS'
                        ? 'bg-amber-100 text-amber-900'
                        : row.status === 'RESOLVED' || row.status === 'CLOSED'
                          ? 'bg-slate-200 text-slate-800'
                          : 'bg-slate-100 text-slate-700'
                  "
                >
                  {{ row.status }}
                </span>
              </td>
              <td class="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell">
                {{ formatDate(row.createdAt) }}
              </td>
              <td class="px-4 py-3 text-right">
                <button
                  type="button"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  @click="openDetail(row)"
                >
                  Manage
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!loading && rows.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
        No support requests yet.
      </p>
    </div>

    <div
      v-if="detail"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      @click.self="closeDetail"
    >
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Ticket</p>
            <h2 class="mt-1 text-lg font-semibold text-slate-900">{{ detail.subject }}</h2>
          </div>
          <button
            type="button"
            class="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            @click="closeDetail"
          >
            Close
          </button>
        </div>
        <p class="mt-3 whitespace-pre-wrap text-sm text-slate-700">{{ detail.message }}</p>
        <dl class="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
          <div class="flex justify-between gap-2">
            <dt>Submitter</dt>
            <dd class="text-right">{{ detail.submitter.email }}</dd>
          </div>
          <div v-if="detail.organization" class="flex justify-between gap-2">
            <dt>Organization</dt>
            <dd class="text-right">
              <RouterLink class="text-indigo-600 hover:text-indigo-800" :to="`/organization/${detail.organization.id}`">
                {{ detail.organization.name }}
              </RouterLink>
            </dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt>Created</dt>
            <dd class="text-right">{{ formatDate(detail.createdAt) }}</dd>
          </div>
        </dl>

        <div class="mt-6 space-y-3">
          <label class="block text-sm">
            <span class="text-slate-700">Status</span>
            <select
              v-model="editStatus"
              class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="OPEN">OPEN</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="RESOLVED">RESOLVED</option>
              <option value="CLOSED">CLOSED</option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-slate-700">Resolution note</span>
            <textarea
              v-model="editNote"
              rows="4"
              class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Internal note or reply summary…"
            />
          </label>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="closeDetail"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="savingId === detail.id"
              @click="saveDetail"
            >
              {{ savingId === detail.id ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
