<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../lib/api';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';

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

const route = useRoute();
const { orgApi } = usePlatformOrgContext();

const members = ref<MemberRow[]>([]);
const invitations = ref<InvitationRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const inviteEmail = ref('');
const inviteRole = ref<'STAFF' | 'MANAGER' | 'OWNER'>('STAFF');
const inviteSaving = ref(false);

const adminInviteBase = computed(() => {
  const raw = import.meta.env.VITE_ADMIN_PUBLIC_URL as string | undefined;
  return (
    (raw?.replace(/\/$/, '') || 'http://localhost:5173') + '/invite?token='
  );
});

function inviteLink(token: string) {
  return `${adminInviteBase.value}${encodeURIComponent(token)}`;
}

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const [m, inv] = await Promise.all([
      api<MemberRow[]>(orgApi('/members')),
      api<InvitationRow[]>(orgApi('/invitations')),
    ]);
    members.value = m;
    invitations.value = inv;
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load team';
  } finally {
    loading.value = false;
  }
}

async function sendInvite() {
  const email = inviteEmail.value.trim();
  if (!email) return;
  inviteSaving.value = true;
  error.value = null;
  try {
    await api(orgApi('/invitations'), {
      method: 'POST',
      body: JSON.stringify({ email, role: inviteRole.value }),
    });
    inviteEmail.value = '';
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Invite failed';
  } finally {
    inviteSaving.value = false;
  }
}

async function removeInvitation(id: string) {
  if (!confirm('Revoke this invitation?')) return;
  try {
    await api(orgApi(`/invitations/${id}`), { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed';
  }
}

async function changeRole(m: MemberRow, role: string) {
  try {
    await api(orgApi(`/members/${m.id}`), {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Update failed';
  }
}

async function removeMember(m: MemberRow) {
  if (!confirm(`Remove ${m.user.email} from this organization?`)) return;
  try {
    await api(orgApi(`/members/${m.id}`), { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Remove failed';
  }
}

onMounted(() => void load());
watch(
  () => route.params.orgId,
  () => void load(),
);
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-slate-600">
      Landlord staff accounts and pending email invitations. Share invite links
      in the admin app at the URL shown.
    </p>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div v-if="loading" class="text-sm text-slate-500">Loading team…</div>

    <template v-else>
      <div class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-900">Invite by email</h3>
        <form
          class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          @submit.prevent="sendInvite"
        >
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
            <select
              v-model="inviteRole"
              class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 sm:w-40"
            >
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
        <h3
          class="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900"
        >
          Members
        </h3>
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
                  @change="
                    changeRole(m, ($event.target as HTMLSelectElement).value)
                  "
                >
                  <option v-for="(label, r) in roleLabels" :key="r" :value="r">
                    {{ label }}
                  </option>
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

      <div
        v-if="invitations.length"
        class="rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <h3
          class="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900"
        >
          Pending invitations
        </h3>
        <ul class="divide-y divide-slate-100">
          <li
            v-for="inv in invitations"
            :key="inv.id"
            class="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="font-medium text-slate-900">{{ inv.email }}</p>
              <p class="text-xs text-slate-500">
                {{ roleLabels[inv.role] ?? inv.role }} · expires
                {{ new Date(inv.expiresAt).toLocaleString() }}
              </p>
              <p class="mt-1 break-all text-xs text-slate-400">
                {{ inviteLink(inv.token) }}
              </p>
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
  </div>
</template>
