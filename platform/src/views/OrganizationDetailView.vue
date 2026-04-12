<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';

type MemberRow = {
  id: string;
  role: string;
  user: { email: string; name: string | null };
};

type OrgDetail = {
  id: string;
  name: string;
  slug: string | null;
  createdAt: string;
  suspendedAt: string | null;
  subscriptionStatus: string;
  members: MemberRow[];
  diagnostics: {
    units: number;
    leases: number;
    pendingInvitations: number;
    members: number;
    properties: number;
    renters: number;
  };
};

const route = useRoute();
const router = useRouter();
const loading = ref(true);
const error = ref<string | null>(null);
const org = ref<OrgDetail | null>(null);

async function load() {
  const id = route.params.orgId as string;
  if (!id) return;
  loading.value = true;
  error.value = null;
  try {
    org.value = await api<OrgDetail>(`/platform/organizations/${id}`);
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
    org.value = null;
  } finally {
    loading.value = false;
  }
}

onMounted(() => void load());
watch(
  () => route.params.orgId,
  () => void load(),
);
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur sm:px-8">
      <div class="mx-auto flex max-w-6xl items-center gap-4">
        <button
          type="button"
          class="text-sm font-medium text-slate-600 hover:text-slate-900"
          @click="router.push('/')"
        >
          ← Organizations
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <div
        v-if="loading"
        class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
      >
        Loading…
      </div>
      <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

      <template v-else-if="org">
        <div class="mb-8">
          <h1 class="text-2xl font-semibold text-slate-900">{{ org.name }}</h1>
          <p v-if="org.slug" class="text-sm text-slate-500">{{ org.slug }}</p>
          <p class="mt-2 text-xs text-slate-400">
            Created {{ new Date(org.createdAt).toLocaleString() }} · Subscription
            {{ org.subscriptionStatus }}
            <span v-if="org.suspendedAt" class="text-red-600"> · Suspended</span>
          </p>
        </div>

        <section class="mb-10">
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Diagnostics</h2>
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="text-xs text-slate-500">Members</p>
              <p class="text-2xl font-semibold text-slate-900">{{ org.diagnostics.members }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="text-xs text-slate-500">Properties</p>
              <p class="text-2xl font-semibold text-slate-900">{{ org.diagnostics.properties }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="text-xs text-slate-500">Units</p>
              <p class="text-2xl font-semibold text-slate-900">{{ org.diagnostics.units }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="text-xs text-slate-500">Renters</p>
              <p class="text-2xl font-semibold text-slate-900">{{ org.diagnostics.renters }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="text-xs text-slate-500">Leases</p>
              <p class="text-2xl font-semibold text-slate-900">{{ org.diagnostics.leases }}</p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p class="text-xs text-slate-500">Pending org invites</p>
              <p class="text-2xl font-semibold text-slate-900">{{ org.diagnostics.pendingInvitations }}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Members (sample)
          </h2>
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th class="px-4 py-2">Email</th>
                  <th class="px-4 py-2">Role</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="m in org.members" :key="m.id">
                  <td class="px-4 py-2">{{ m.user.email }}</td>
                  <td class="px-4 py-2">{{ m.role }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
