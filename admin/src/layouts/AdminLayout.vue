<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { useOrgStore } from '../stores/org';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const orgStore = useOrgStore();
const { organizations: orgs, organizationsLoading: loadingOrgs, selectedOrgId } =
  storeToRefs(orgStore);

const mobileNavOpen = ref(false);

const pageTitle = computed(() => (route.meta.title as string) ?? 'Admin');

const userLabel = computed(() => auth.user?.email ?? 'Signed in');

function logout() {
  auth.clearSession();
  void router.push({ name: 'login' });
}

const nav = [
  { to: '/', label: 'Overview', icon: 'grid' },
  { to: '/properties', label: 'Properties', icon: 'building' },
  { to: '/renters', label: 'Renters', icon: 'users' },
  { to: '/leases', label: 'Leases', icon: 'file' },
  { to: '/payments', label: 'Payments', icon: 'wallet' },
  { to: '/team', label: 'Team', icon: 'team' },
] as const;

function closeMobileNav() {
  mobileNavOpen.value = false;
}

watch(
  () => route.fullPath,
  () => {
    closeMobileNav();
  },
);

onMounted(() => {
  void orgStore.fetchOrganizations();
});
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
    <div
      v-if="mobileNavOpen"
      class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
      aria-hidden="true"
      @click="closeMobileNav"
    />

    <aside
      :class="[
        'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800/80 bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-xl transition-transform duration-200 lg:translate-x-0',
        mobileNavOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
      ]"
    >
      <div class="flex h-16 items-center gap-3 border-b border-white/10 px-5">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-lg font-bold text-white shadow-lg shadow-emerald-900/40"
        >
          LM
        </div>
        <div>
          <p class="text-xs font-medium uppercase tracking-wider text-slate-400">Console</p>
          <p class="text-sm font-semibold text-white">Landlord Admin</p>
        </div>
      </div>

      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          end
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          active-class="!bg-white/10 !text-white shadow-inner"
        >
          <span
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400 group-[.router-link-active]:bg-emerald-500/20 group-[.router-link-active]:text-emerald-400"
          >
            <svg v-if="item.icon === 'grid'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            <svg v-else-if="item.icon === 'building'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <svg v-else-if="item.icon === 'users'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else-if="item.icon === 'file'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <svg v-else-if="item.icon === 'team'" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <svg v-else class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </span>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="border-t border-white/10 p-4">
        <p class="text-xs text-slate-500">Property & rent operations</p>
        <p class="mt-1 text-xs text-slate-400">v0.1 · local dev</p>
      </div>
    </aside>

    <div class="lg:pl-72">
      <header
        class="sticky top-0 z-30 flex min-h-16 flex-col gap-3 border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            class="inline-flex shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            aria-label="Open menu"
            @click="mobileNavOpen = true"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div class="min-w-0">
            <h1 class="truncate text-lg font-semibold text-slate-900">{{ pageTitle }}</h1>
            <p class="hidden text-xs text-slate-500 sm:block">Portfolio, renters & rent collection</p>
          </div>
        </div>

        <div class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:shrink-0">
          <div class="hidden min-w-0 max-w-[200px] text-right sm:block">
            <p class="truncate text-xs text-slate-500">{{ userLabel }}</p>
          </div>
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            @click="logout"
          >
            Sign out
          </button>
          <label class="block w-full sm:w-auto">
            <span class="sr-only">Organization</span>
            <select
              :value="selectedOrgId ?? ''"
              class="w-full min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:max-w-[260px]"
              :disabled="loadingOrgs"
              @change="orgStore.setOrg(($event.target as HTMLSelectElement).value || null)"
            >
              <option value="" disabled>{{ loadingOrgs ? 'Loading…' : 'Select organization' }}</option>
              <option v-for="o in orgs" :key="o.id" :value="o.id">{{ o.name }}</option>
            </select>
          </label>
        </div>
      </header>

      <main class="p-4 sm:p-6 lg:p-8">
        <RouterView v-slot="{ Component }">
          <Transition name="fade" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </main>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
