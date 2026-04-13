<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();
const orgId = computed(() => route.params.orgId as string);
const base = computed(() => `/organization/${orgId.value}`);
const name = computed(() => route.name as string | undefined);

function cls(active: boolean) {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    active
      ? 'bg-indigo-100 text-indigo-900'
      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
  ];
}

const active = computed(() => ({
  overview: name.value === 'organization-detail',
  team: name.value === 'organization-team',
  properties:
    name.value === 'organization-properties' ||
    name.value === 'organization-property-units',
  renters: name.value === 'organization-renters',
  leases: name.value === 'organization-leases',
  payments: name.value === 'organization-payments',
  signups: name.value === 'organization-signups',
}));
</script>

<template>
  <div class="mb-8 flex flex-wrap gap-2 border-b border-slate-200/80 pb-4">
    <RouterLink :class="cls(active.overview)" :to="base">Overview</RouterLink>
    <RouterLink :class="cls(active.team)" :to="`${base}/team`">Team</RouterLink>
    <RouterLink :class="cls(active.properties)" :to="`${base}/properties`"
      >Properties</RouterLink
    >
    <RouterLink :class="cls(active.renters)" :to="`${base}/renters`"
      >Renters</RouterLink
    >
    <RouterLink :class="cls(active.leases)" :to="`${base}/leases`"
      >Leases</RouterLink
    >
    <RouterLink :class="cls(active.payments)" :to="`${base}/payments`"
      >Payments</RouterLink
    >
    <RouterLink :class="cls(active.signups)" :to="`${base}/signups`"
      >Tenant signups</RouterLink
    >
    <RouterLink
      class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-white/80 hover:text-slate-900"
      :to="{ name: 'support-requests', query: { organizationId: orgId } }"
    >
      Support tickets
    </RouterLink>
  </div>
</template>
