<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();

type MemberRow = {
  id: string;
  role: string;
  user: { id: string; email: string; name: string | null; phone: string | null };
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  token: string;
};

const members = ref<MemberRow[]>([]);
const invitations = ref<InvitationRow[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const inviteEmail = ref('');
const inviteRole = ref<'STAFF' | 'MANAGER' | 'OWNER'>('STAFF');
const saving = ref(false);

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

async function load() {
  if (!hasOrg.value) return;
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
  saving.value = true;
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
    saving.value = false;
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

const origin = typeof window !== 'undefined' ? window.location.origin : '';
function inviteLink(token: string) {
  return `${origin}/invite?token=${encodeURIComponent(token)}`;
}

onMounted(() => void load());
watch(hasOrg, () => void load());
</script>

<template>
  <div>
    <SelectOrgPrompt v-if="!hasOrg" />

    <template v-else>
      <p class="mb-6 text-sm text-slate-600">
        Invite colleagues by email. They must register or sign in with that email, then open the invite link to join
        this organization.
      </p>

      <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

      <div
        v-if="loading"
        class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
      >
        Loading team…
      </div>

      <template v-else>
        <section class="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 class="text-lg font-semibold text-slate-900">Invite member</h2>
          <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label class="block flex-1">
              <span class="text-sm font-medium text-slate-700">Email</span>
              <input
                v-model="inviteEmail"
                type="email"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="colleague@company.com"
              />
            </label>
            <label class="block sm:w-40">
              <span class="text-sm font-medium text-slate-700">Role</span>
              <select
                v-model="inviteRole"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="STAFF">Staff</option>
                <option value="MANAGER">Manager</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
            <button
              type="button"
              class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              :disabled="saving || !inviteEmail.trim()"
              @click="sendInvite"
            >
              {{ saving ? 'Sending…' : 'Create invite' }}
            </button>
          </div>
        </section>

        <section v-if="invitations.length" class="mb-10">
          <h2 class="mb-3 text-lg font-semibold text-slate-900">Pending invitations</h2>
          <ul class="space-y-3">
            <li
              v-for="inv in invitations"
              :key="inv.id"
              class="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p class="font-medium text-slate-900">{{ inv.email }}</p>
                <p class="text-xs text-slate-500">
                  {{ roleLabels[inv.role] ?? inv.role }} · expires
                  {{ new Date(inv.expiresAt).toLocaleString() }}
                </p>
                <p class="mt-1 break-all font-mono text-xs text-slate-600">{{ inviteLink(inv.token) }}</p>
              </div>
              <button
                type="button"
                class="shrink-0 text-sm font-medium text-red-600 hover:underline"
                @click="removeInvitation(inv.id)"
              >
                Revoke
              </button>
            </li>
          </ul>
        </section>

        <section>
          <h2 class="mb-3 text-lg font-semibold text-slate-900">Members</h2>
          <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table class="min-w-full text-left text-sm">
              <thead class="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th class="px-4 py-3">User</th>
                  <th class="px-4 py-3">Role</th>
                  <th class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="m in members" :key="m.id" class="hover:bg-slate-50/80">
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-900">{{ m.user.email }}</p>
                    <p v-if="m.user.name" class="text-xs text-slate-500">{{ m.user.name }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <select
                      class="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                      :value="m.role"
                      @change="
                        changeRole(m, ($event.target as HTMLSelectElement).value)
                      "
                    >
                      <option value="STAFF">Staff</option>
                      <option value="MANAGER">Manager</option>
                      <option value="OWNER">Owner</option>
                    </select>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      type="button"
                      class="text-sm font-medium text-red-600 hover:underline"
                      @click="removeMember(m)"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
            <p v-if="!members.length" class="px-4 py-8 text-center text-sm text-slate-500">No members.</p>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
