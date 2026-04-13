<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import type { Paginated, Property, Unit } from '../types/models';

type MemberRow = {
  id: string;
  role: string;
  user: { email: string; name: string | null; phone: string | null };
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  token: string;
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

type SignupRow = {
  id: string;
  status: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    createdAt: string;
  };
};

const route = useRoute();
const router = useRouter();

const tab = ref<'overview' | 'team' | 'signups'>('overview');

const loading = ref(true);
const error = ref<string | null>(null);
const org = ref<OrgDetail | null>(null);

const editName = ref('');
const editSlug = ref('');
const savingMeta = ref(false);
const metaError = ref<string | null>(null);

const suspendBusy = ref(false);
const deleteBusy = ref(false);

const members = ref<MemberRow[]>([]);
const invitations = ref<InvitationRow[]>([]);
const teamLoading = ref(false);
const teamError = ref<string | null>(null);
const inviteEmail = ref('');
const inviteRole = ref<'STAFF' | 'MANAGER' | 'OWNER'>('STAFF');
const inviteSaving = ref(false);

const signups = ref<SignupRow[]>([]);
const signupsLoading = ref(false);
const signupsError = ref<string | null>(null);
const actionError = ref<string | null>(null);
const unitOptions = ref<{ id: string; label: string; propertyName: string }[]>([]);
const showApprove = ref<SignupRow | null>(null);
const approveForm = ref({
  unitId: '',
  startDate: new Date().toISOString().slice(0, 10),
  rentAmount: '',
  dueDay: '1',
  currency: 'XAF',
  prepaidMonths: '0',
});
const approveSaving = ref(false);

const orgId = computed(() => route.params.orgId as string);

function orgApi(path: string) {
  const base = `/organizations/${orgId.value}`;
  if (!path || path === '/') return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

const adminInviteBase = computed(() => {
  const raw = import.meta.env.VITE_ADMIN_PUBLIC_URL as string | undefined;
  return (raw?.replace(/\/$/, '') || 'http://localhost:5173') + '/invite?token=';
});

function inviteLink(token: string) {
  return `${adminInviteBase.value}${encodeURIComponent(token)}`;
}

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

async function loadOrg() {
  const id = orgId.value;
  if (!id) return;
  loading.value = true;
  error.value = null;
  try {
    org.value = await api<OrgDetail>(`/platform/organizations/${id}`);
    editName.value = org.value.name;
    editSlug.value = org.value.slug ?? '';
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
    org.value = null;
  } finally {
    loading.value = false;
  }
}

async function saveMeta() {
  if (!org.value) return;
  savingMeta.value = true;
  metaError.value = null;
  try {
    const slug = editSlug.value.trim();
    const body: { name: string; slug?: string } = { name: editName.value.trim() };
    if (slug) body.slug = slug;
    await api(orgApi(''), {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    await loadOrg();
  } catch (e) {
    metaError.value = e instanceof Error ? e.message : 'Save failed';
  } finally {
    savingMeta.value = false;
  }
}

async function toggleSuspend() {
  if (!org.value) return;
  const next = !org.value.suspendedAt;
  suspendBusy.value = true;
  error.value = null;
  try {
    await api(`/platform/organizations/${org.value.id}/suspend`, {
      method: 'PATCH',
      body: JSON.stringify({ suspended: next }),
    });
    await loadOrg();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Update failed';
  } finally {
    suspendBusy.value = false;
  }
}

async function removeOrg() {
  if (!org.value) return;
  if (
    !confirm(
      `Delete organization “${org.value.name}” permanently? This removes properties, units, leases, and members. This cannot be undone.`,
    )
  ) {
    return;
  }
  deleteBusy.value = true;
  error.value = null;
  try {
    await api(orgApi(''), { method: 'DELETE' });
    await router.replace('/');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Delete failed';
  } finally {
    deleteBusy.value = false;
  }
}

async function loadTeam() {
  teamLoading.value = true;
  teamError.value = null;
  try {
    const [m, inv] = await Promise.all([
      api<MemberRow[]>(orgApi('/members')),
      api<InvitationRow[]>(orgApi('/invitations')),
    ]);
    members.value = m;
    invitations.value = inv;
  } catch (e) {
    teamError.value = e instanceof Error ? e.message : 'Failed to load team';
  } finally {
    teamLoading.value = false;
  }
}

async function sendInvite() {
  const email = inviteEmail.value.trim();
  if (!email) return;
  inviteSaving.value = true;
  teamError.value = null;
  try {
    await api(orgApi('/invitations'), {
      method: 'POST',
      body: JSON.stringify({ email, role: inviteRole.value }),
    });
    inviteEmail.value = '';
    await loadTeam();
  } catch (e) {
    teamError.value = e instanceof Error ? e.message : 'Invite failed';
  } finally {
    inviteSaving.value = false;
  }
}

async function removeInvitation(id: string) {
  if (!confirm('Revoke this invitation?')) return;
  try {
    await api(orgApi(`/invitations/${id}`), { method: 'DELETE' });
    await loadTeam();
  } catch (e) {
    teamError.value = e instanceof Error ? e.message : 'Failed';
  }
}

async function changeRole(m: MemberRow, role: string) {
  try {
    await api(orgApi(`/members/${m.id}`), {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    await loadTeam();
    await loadOrg();
  } catch (e) {
    teamError.value = e instanceof Error ? e.message : 'Update failed';
  }
}

async function removeMember(m: MemberRow) {
  if (!confirm(`Remove ${m.user.email} from this organization?`)) return;
  try {
    await api(orgApi(`/members/${m.id}`), { method: 'DELETE' });
    await loadTeam();
    await loadOrg();
  } catch (e) {
    teamError.value = e instanceof Error ? e.message : 'Remove failed';
  }
}

async function loadSignups() {
  signupsLoading.value = true;
  signupsError.value = null;
  try {
    signups.value = await api<SignupRow[]>(orgApi('/tenant-signups'));
  } catch (e) {
    signupsError.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    signupsLoading.value = false;
  }
}

async function loadUnitsForApprove() {
  const propsRes = await api<Paginated<Property>>(orgApi('/properties?limit=100'));
  const pairs: { id: string; label: string; propertyName: string }[] = [];
  for (const p of propsRes.items) {
    const unitsRes = await api<Paginated<Unit>>(orgApi(`/properties/${p.id}/units?limit=500`));
    for (const u of unitsRes.items) {
      pairs.push({ id: u.id, label: u.label, propertyName: p.name });
    }
  }
  unitOptions.value = pairs;
}

function openApprove(row: SignupRow) {
  actionError.value = null;
  approveForm.value = {
    unitId: '',
    startDate: new Date().toISOString().slice(0, 10),
    rentAmount: '',
    dueDay: '1',
    currency: 'XAF',
    prepaidMonths: '0',
  };
  showApprove.value = row;
  void loadUnitsForApprove();
}

async function submitApprove() {
  const row = showApprove.value;
  if (!row) return;
  const rent = Number.parseFloat(approveForm.value.rentAmount);
  if (!approveForm.value.unitId || Number.isNaN(rent)) {
    actionError.value = 'Choose a unit and enter rent.';
    return;
  }
  approveSaving.value = true;
  actionError.value = null;
  try {
    const prepaid = Number.parseInt(approveForm.value.prepaidMonths, 10);
    await api(orgApi(`/tenant-signups/${row.id}/approve`), {
      method: 'POST',
      body: JSON.stringify({
        unitId: approveForm.value.unitId,
        startDate: new Date(approveForm.value.startDate).toISOString(),
        rentAmount: rent,
        dueDay: Number.parseInt(approveForm.value.dueDay, 10) || 1,
        currency: approveForm.value.currency.trim() || 'XAF',
        prepaidMonths: Number.isNaN(prepaid) ? 0 : Math.min(60, Math.max(0, prepaid)),
      }),
    });
    showApprove.value = null;
    await loadSignups();
    await loadOrg();
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Approve failed';
  } finally {
    approveSaving.value = false;
  }
}

async function rejectSignup(row: SignupRow) {
  if (!confirm(`Reject signup for ${row.user.email}?`)) return;
  actionError.value = null;
  try {
    await api(orgApi(`/tenant-signups/${row.id}/reject`), { method: 'POST' });
    await loadSignups();
  } catch (e) {
    actionError.value = e instanceof Error ? e.message : 'Reject failed';
  }
}

watch(tab, (t) => {
  if (t === 'team') void loadTeam();
  if (t === 'signups') void loadSignups();
});

onMounted(() => void loadOrg());
watch(
  () => route.params.orgId,
  () => void loadOrg(),
);
</script>

<template>
  <div>
    <div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <RouterLink class="text-sm font-medium text-indigo-600 hover:text-indigo-800" to="/">
          ← All organizations
        </RouterLink>
        <h1 v-if="org" class="mt-2 text-2xl font-bold tracking-tight text-slate-900">{{ org.name }}</h1>
        <p v-if="org?.slug" class="text-sm text-slate-500">{{ org.slug }}</p>
      </div>
      <RouterLink
        v-if="route.params.orgId"
        class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        :to="{ name: 'support-requests', query: { organizationId: String(route.params.orgId) } }"
      >
        Support tickets →
      </RouterLink>
    </div>

    <div
      v-if="loading"
      class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
    >
      Loading…
    </div>
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-else-if="org">
      <div class="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          type="button"
          class="rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors"
          :class="
            tab === 'overview'
              ? 'border-b-2 border-indigo-600 text-indigo-700'
              : 'text-slate-500 hover:text-slate-800'
          "
          @click="tab = 'overview'"
        >
          Overview
        </button>
        <button
          type="button"
          class="rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors"
          :class="
            tab === 'team'
              ? 'border-b-2 border-indigo-600 text-indigo-700'
              : 'text-slate-500 hover:text-slate-800'
          "
          @click="tab = 'team'"
        >
          Team & invites
        </button>
        <button
          type="button"
          class="rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors"
          :class="
            tab === 'signups'
              ? 'border-b-2 border-indigo-600 text-indigo-700'
              : 'text-slate-500 hover:text-slate-800'
          "
          @click="tab = 'signups'"
        >
          Tenant signups
        </button>
      </div>

      <section v-show="tab === 'overview'" class="space-y-8">
        <div class="flex flex-wrap items-center gap-3">
          <span
            class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
            :class="org.suspendedAt ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'"
          >
            {{ org.suspendedAt ? 'Suspended' : 'Active' }}
          </span>
          <span class="text-xs text-slate-500">Subscription {{ org.subscriptionStatus }}</span>
        </div>

        <div class="grid gap-4 lg:grid-cols-2">
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-slate-900">Organization details</h2>
            <p class="mt-1 text-xs text-slate-500">Saved with the same API landlords use.</p>
            <form class="mt-4 space-y-3" @submit.prevent="saveMeta">
              <label class="block text-sm">
                <span class="text-slate-700">Name</span>
                <input v-model="editName" required class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <label class="block text-sm">
                <span class="text-slate-700">Slug</span>
                <input v-model="editSlug" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
              </label>
              <p v-if="metaError" class="text-sm text-red-600">{{ metaError }}</p>
              <button
                type="submit"
                class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="savingMeta"
              >
                {{ savingMeta ? 'Saving…' : 'Save changes' }}
              </button>
            </form>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 class="text-sm font-semibold text-slate-900">Danger zone</h2>
            <p class="mt-1 text-xs text-slate-500">Suspend blocks landlord staff; delete removes all org data.</p>
            <div class="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                :disabled="suspendBusy"
                @click="toggleSuspend"
              >
                {{ suspendBusy ? '…' : org.suspendedAt ? 'Unsuspend organization' : 'Suspend organization' }}
              </button>
              <button
                type="button"
                class="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                :disabled="deleteBusy"
                @click="removeOrg"
              >
                {{ deleteBusy ? '…' : 'Delete organization' }}
              </button>
            </div>
          </div>
        </div>

        <div>
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
        </div>
      </section>

      <section v-show="tab === 'team'" class="space-y-6">
        <p v-if="teamError" class="text-sm text-red-600">{{ teamError }}</p>
        <div v-if="teamLoading" class="text-sm text-slate-500">Loading team…</div>

        <template v-else>
          <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 class="text-sm font-semibold text-slate-900">Invite by email</h3>
            <p class="mt-1 text-xs text-slate-500">Staff open the link in the landlord admin app to join.</p>
            <form class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" @submit.prevent="sendInvite">
              <label class="block min-w-0 flex-1 text-sm">
                <span class="text-slate-700">Email</span>
                <input
                  v-model="inviteEmail"
                  type="email"
                  required
                  class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                />
              </label>
              <label class="block text-sm">
                <span class="text-slate-700">Role</span>
                <select v-model="inviteRole" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 sm:w-40">
                  <option value="STAFF">Staff</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OWNER">Owner</option>
                </select>
              </label>
              <button
                type="submit"
                class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                :disabled="inviteSaving"
              >
                {{ inviteSaving ? 'Sending…' : 'Send invite' }}
              </button>
            </form>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h3 class="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Members</h3>
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs font-semibold text-slate-500">
                <tr>
                  <th class="px-4 py-2">Email</th>
                  <th class="px-4 py-2">Role</th>
                  <th class="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="m in members" :key="m.id">
                  <td class="px-4 py-2">{{ m.user.email }}</td>
                  <td class="px-4 py-2">
                    <select
                      class="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                      :value="m.role"
                      @change="changeRole(m, ($event.target as HTMLSelectElement).value)"
                    >
                      <option v-for="(label, r) in roleLabels" :key="r" :value="r">{{ label }}</option>
                    </select>
                  </td>
                  <td class="px-4 py-2 text-right">
                    <button
                      type="button"
                      class="text-xs font-semibold text-red-600 hover:text-red-800"
                      @click="removeMember(m)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="invitations.length" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h3 class="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">Pending invitations</h3>
            <ul class="divide-y divide-slate-100">
              <li v-for="inv in invitations" :key="inv.id" class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p class="font-medium text-slate-900">{{ inv.email }}</p>
                  <p class="text-xs text-slate-500">{{ roleLabels[inv.role] ?? inv.role }} · expires {{ new Date(inv.expiresAt).toLocaleString() }}</p>
                  <p class="mt-1 break-all text-xs text-slate-400">{{ inviteLink(inv.token) }}</p>
                </div>
                <button
                  type="button"
                  class="shrink-0 text-sm font-semibold text-red-600 hover:text-red-800"
                  @click="removeInvitation(inv.id)"
                >
                  Revoke
                </button>
              </li>
            </ul>
          </div>
        </template>
      </section>

      <section v-show="tab === 'signups'" class="space-y-4">
        <p class="text-sm text-slate-600">
          Pending self-serve tenant registrations for this organization. Approve by assigning a unit and lease terms.
        </p>
        <p v-if="signupsError" class="text-sm text-red-600">{{ signupsError }}</p>
        <p v-if="actionError" class="text-sm text-red-600">{{ actionError }}</p>
        <div v-if="signupsLoading" class="text-sm text-slate-500">Loading…</div>
        <div v-else-if="!signups.length" class="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
          No pending signups.
        </div>
        <ul v-else class="space-y-3">
          <li
            v-for="row in signups"
            :key="row.id"
            class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="font-medium text-slate-900">{{ row.user.email }}</p>
              <p class="text-xs text-slate-500">
                {{ row.user.name || '—' }} · requested {{ new Date(row.createdAt).toLocaleString() }}
              </p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-700"
                @click="openApprove(row)"
              >
                Approve
              </button>
              <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                @click="rejectSignup(row)"
              >
                Reject
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <div
      v-if="showApprove"
      class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      @click.self="showApprove = null"
    >
      <div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <h3 class="text-lg font-semibold text-slate-900">Approve signup</h3>
        <p class="mt-1 text-sm text-slate-600">{{ showApprove?.user.email }}</p>
        <form class="mt-4 space-y-3" @submit.prevent="submitApprove">
          <label class="block text-sm">
            <span class="text-slate-700">Unit</span>
            <select v-model="approveForm.unitId" required class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2">
              <option disabled value="">Select unit…</option>
              <option v-for="u in unitOptions" :key="u.id" :value="u.id">
                {{ u.propertyName }} — {{ u.label }}
              </option>
            </select>
          </label>
          <label class="block text-sm">
            <span class="text-slate-700">Start date</span>
            <input v-model="approveForm.startDate" type="date" required class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <label class="block text-sm">
            <span class="text-slate-700">Monthly rent</span>
            <input v-model="approveForm.rentAmount" type="number" step="any" required class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="text-slate-700">Due day</span>
              <input v-model="approveForm.dueDay" type="number" min="1" max="28" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label class="block text-sm">
              <span class="text-slate-700">Currency</span>
              <input v-model="approveForm.currency" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
          </div>
          <label class="block text-sm">
            <span class="text-slate-700">Prepaid months (0–60)</span>
            <input v-model="approveForm.prepaidMonths" type="number" min="0" max="60" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
          </label>
          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold" @click="showApprove = null">Cancel</button>
            <button
              type="submit"
              class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              :disabled="approveSaving"
            >
              {{ approveSaving ? 'Saving…' : 'Approve' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
