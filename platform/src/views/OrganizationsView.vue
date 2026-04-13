<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

type OrgRow = {
  id: string;
  name: string;
  slug: string | null;
  suspendedAt: string | null;
  subscriptionStatus: string;
  createdAt: string;
  _count: { members: number; properties: number; renters: number };
};

const router = useRouter();
const auth = useAuthStore();

const loading = ref(true);
const error = ref<string | null>(null);
const rows = ref<OrgRow[]>([]);
const busyId = ref<string | null>(null);

function formatDate(iso: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    rows.value = await api<OrgRow[]>('/platform/organizations');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load organizations';
  } finally {
    loading.value = false;
  }
}

async function toggleSuspend(org: OrgRow) {
  const next = !org.suspendedAt;
  busyId.value = org.id;
  error.value = null;
  try {
    await api(`/platform/organizations/${org.id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ suspended: next }),
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Update failed';
  } finally {
    busyId.value = null;
  }
}

function logout() {
  auth.clearSession();
  void router.push('/login');
}

onMounted(() => {
  void load();
});
</script>

<template>
  <div class="min-h-screen">
    <header
      class="sticky top-0 z-10 border-b border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm backdrop-blur-md sm:px-8"
    >
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white"
          >
            LM
          </div>
          <div>
            <h1 class="text-lg font-semibold text-slate-900">Organizations</h1>
            <p class="text-xs text-slate-500">Platform administration</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <RouterLink
            class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            to="/support"
          >
            Support
          </RouterLink>
          <span v-if="auth.user" class="hidden text-sm text-slate-600 sm:inline">{{ auth.user.email }}</span>
          <button
            type="button"
            class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            @click="logout"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <p v-if="error" class="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
        {{ error }}
      </p>

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
                <th class="px-4 py-3">Name</th>
                <th class="hidden px-4 py-3 sm:table-cell">Detail</th>
                <th class="px-4 py-3">Status</th>
                <th class="hidden px-4 py-3 md:table-cell">Subscription</th>
                <th class="hidden px-4 py-3 lg:table-cell">Counts</th>
                <th class="px-4 py-3">Suspended</th>
                <th class="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="org in rows" :key="org.id" class="hover:bg-slate-50/50">
                <td class="px-4 py-3 font-medium text-slate-900">
                  {{ org.name }}
                  <span v-if="org.slug" class="mt-0.5 block text-xs font-normal text-slate-500">{{ org.slug }}</span>
                </td>
                <td class="hidden px-4 py-3 sm:table-cell">
                  <RouterLink
                    class="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                    :to="`/organization/${org.id}`"
                  >
                    View
                  </RouterLink>
                </td>
                <td class="px-4 py-3">
                  <span
                    class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
                    :class="org.suspendedAt ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'"
                  >
                    {{ org.suspendedAt ? 'Suspended' : 'Active' }}
                  </span>
                </td>
                <td class="hidden px-4 py-3 text-slate-600 md:table-cell">{{ org.subscriptionStatus }}</td>
                <td class="hidden px-4 py-3 text-xs text-slate-600 lg:table-cell">
                  {{ org._count.members }} members · {{ org._count.properties }} props · {{ org._count.renters }} renters
                </td>
                <td class="px-4 py-3 text-xs text-slate-500">{{ formatDate(org.suspendedAt) }}</td>
                <td class="px-4 py-3 text-right">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    :disabled="busyId === org.id"
                    @click="toggleSuspend(org)"
                  >
                    {{ org.suspendedAt ? 'Unsuspend' : 'Suspend' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="!loading && rows.length === 0" class="px-4 py-8 text-center text-sm text-slate-500">
          No organizations yet.
        </p>
      </div>
    </main>
  </div>
</template>
