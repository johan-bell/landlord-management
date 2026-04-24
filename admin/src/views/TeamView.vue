<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import { useOrgElevatedAccess } from '../composables/useOrgElevatedAccess';
import { useToastStore } from '../stores/toast';
import { ORG_ROLE_GUIDE, ORG_ROLE_LABEL } from '../lib/orgRoles';

const { hasOrg, orgApi } = useOrgContext();
const toast = useToastStore();

/** Invitations and role changes (API: owner or manager; platform admins bypass). */
const canManageTeam = useOrgElevatedAccess();

type MemberRow = {
    id: string;
    role: string;
    user: {
        id: string;
        email: string | null;
        name: string | null;
        phone: string | null;
    };
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

const confirmRevokeInvite = ref<InvitationRow | null>(null);
const confirmRemoveMember = ref<MemberRow | null>(null);

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        const m = await api<MemberRow[]>(orgApi('/members'));
        members.value = m;
        if (canManageTeam.value) {
            invitations.value = await api<InvitationRow[]>(
                orgApi('/invitations'),
            );
        } else {
            invitations.value = [];
        }
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
    try {
        await api(orgApi('/invitations'), {
            method: 'POST',
            body: JSON.stringify({ email, role: inviteRole.value }),
        });
        inviteEmail.value = '';
        toast.success(`Invitation sent to ${email}`);
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Invite failed');
    } finally {
        saving.value = false;
    }
}

async function doRevokeInvitation() {
    const inv = confirmRevokeInvite.value;
    if (!inv) return;
    try {
        await api(orgApi(`/invitations/${inv.id}`), { method: 'DELETE' });
        toast.success('Invitation revoked');
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to revoke');
    } finally {
        confirmRevokeInvite.value = null;
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
        toast.error(e instanceof Error ? e.message : 'Update failed');
    }
}

async function doRemoveMember() {
    const m = confirmRemoveMember.value;
    if (!m) return;
    try {
        await api(orgApi(`/members/${m.id}`), { method: 'DELETE' });
        toast.success('Member removed');
        await load();
    } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Remove failed');
    } finally {
        confirmRemoveMember.value = null;
    }
}

const origin = typeof window !== 'undefined' ? window.location.origin : '';
function inviteLink(token: string) {
    return `${origin}/invite?token=${encodeURIComponent(token)}`;
}

onMounted(() => void load());
watch(hasOrg, () => void load());
watch(canManageTeam, () => void load());
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <div
                class="mb-6 rounded-2xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-700"
            >
                <p class="font-semibold text-slate-900">
                    Roles in this console
                </p>
                <p class="mt-1 text-xs text-slate-500">
                    Everyone below belongs to this organization. The
                    <strong>role</strong> sets team administration, approvals,
                    billing, and org settings; see each role below for details.
                </p>
                <ul class="mt-3 space-y-2.5 text-xs leading-relaxed">
                    <li v-for="g in ORG_ROLE_GUIDE" :key="g.role">
                        <span class="font-semibold text-slate-900">{{
                            g.title
                        }}</span>
                        <span class="text-slate-600"> — {{ g.body }}</span>
                    </li>
                </ul>
            </div>

            <p class="mb-6 text-sm text-slate-600">
                <template v-if="canManageTeam">
                    Invite colleagues by email. They must register or sign in
                    with that email, then open the invite link to join this
                    organization.
                </template>
                <template v-else>
                    You can see who belongs to this organization. Only
                    <strong>owners</strong> and <strong>managers</strong> can
                    send invites or change roles — see the role descriptions
                    above.
                </template>
            </p>

            <p
                v-if="error"
                class="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
                {{ error }}
            </p>

            <div
                v-if="loading"
                class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
            >
                Loading team…
            </div>

            <template v-else>
                <section
                    v-if="canManageTeam"
                    class="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                    <h2 class="text-lg font-semibold text-slate-900">
                        Invite member
                    </h2>
                    <div
                        class="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
                    >
                        <label class="block flex-1">
                            <span class="text-sm font-medium text-slate-700"
                                >Email</span
                            >
                            <input
                                v-model="inviteEmail"
                                type="email"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                placeholder="colleague@company.com"
                            />
                        </label>
                        <label class="block sm:w-40">
                            <span class="text-sm font-medium text-slate-700"
                                >Role</span
                            >
                            <select
                                v-model="inviteRole"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            >
                                <option value="STAFF">
                                    {{ ORG_ROLE_LABEL.STAFF }}
                                </option>
                                <option value="MANAGER">
                                    {{ ORG_ROLE_LABEL.MANAGER }}
                                </option>
                                <option value="OWNER">
                                    {{ ORG_ROLE_LABEL.OWNER }}
                                </option>
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

                <section
                    v-if="canManageTeam && invitations.length"
                    class="mb-10"
                >
                    <h2 class="mb-3 text-lg font-semibold text-slate-900">
                        Pending invitations
                    </h2>
                    <ul class="space-y-3">
                        <li
                            v-for="inv in invitations"
                            :key="inv.id"
                            class="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <p class="font-medium text-slate-900">
                                    {{ inv.email }}
                                </p>
                                <p class="text-xs text-slate-500">
                                    {{
                                        ORG_ROLE_LABEL[
                                            inv.role as keyof typeof ORG_ROLE_LABEL
                                        ] ?? inv.role
                                    }}
                                    · expires
                                    {{
                                        new Date(inv.expiresAt).toLocaleString()
                                    }}
                                </p>
                                <p
                                    class="mt-1 break-all font-mono text-xs text-slate-600"
                                >
                                    {{ inviteLink(inv.token) }}
                                </p>
                            </div>
                            <button
                                type="button"
                                class="shrink-0 text-sm font-medium text-red-600 hover:underline"
                                @click="confirmRevokeInvite = inv"
                            >
                                Revoke
                            </button>
                        </li>
                    </ul>
                </section>

                <section>
                    <h2 class="mb-3 text-lg font-semibold text-slate-900">
                        Members
                    </h2>
                    <div
                        class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                    >
                        <table class="min-w-full text-left text-sm">
                            <thead
                                class="bg-slate-50 text-xs font-semibold uppercase text-slate-500"
                            >
                                <tr>
                                    <th class="px-4 py-3">User</th>
                                    <th class="px-4 py-3">Role</th>
                                    <th class="px-4 py-3 text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                <tr
                                    v-for="m in members"
                                    :key="m.id"
                                    class="hover:bg-slate-50/80"
                                >
                                    <td class="px-4 py-3">
                                        <p class="font-medium text-slate-900">
                                            {{
                                                m.user.email ??
                                                (canManageTeam
                                                    ? '—'
                                                    : 'Hidden for Staff')
                                            }}
                                        </p>
                                        <p
                                            v-if="m.user.name"
                                            class="text-xs text-slate-500"
                                        >
                                            {{ m.user.name }}
                                        </p>
                                    </td>
                                    <td class="px-4 py-3">
                                        <select
                                            v-if="canManageTeam"
                                            class="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                                            :value="m.role"
                                            @change="
                                                changeRole(
                                                    m,
                                                    (
                                                        $event.target as HTMLSelectElement
                                                    ).value,
                                                )
                                            "
                                        >
                                            <option value="STAFF">
                                                {{ ORG_ROLE_LABEL.STAFF }}
                                            </option>
                                            <option value="MANAGER">
                                                {{ ORG_ROLE_LABEL.MANAGER }}
                                            </option>
                                            <option value="OWNER">
                                                {{ ORG_ROLE_LABEL.OWNER }}
                                            </option>
                                        </select>
                                        <span v-else class="text-slate-700">{{
                                            ORG_ROLE_LABEL[
                                                m.role as keyof typeof ORG_ROLE_LABEL
                                            ] ?? m.role
                                        }}</span>
                                    </td>
                                    <td class="px-4 py-3 text-right">
                                        <button
                                            v-if="canManageTeam"
                                            type="button"
                                            class="text-sm font-medium text-red-600 hover:underline"
                                            @click="confirmRemoveMember = m"
                                        >
                                            Remove
                                        </button>
                                        <span v-else class="text-slate-400"
                                            >—</span
                                        >
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <p
                            v-if="!members.length"
                            class="px-4 py-8 text-center text-sm text-slate-500"
                        >
                            No members.
                        </p>
                    </div>
                </section>
            </template>
        </template>

        <ConfirmDialog
            :open="!!confirmRevokeInvite"
            title="Revoke invitation"
            :message="`Revoke the invitation for ${confirmRevokeInvite?.email}? The link will stop working.`"
            confirm-label="Revoke"
            danger
            @update:open="confirmRevokeInvite = null"
            @confirm="doRevokeInvitation"
        />

        <ConfirmDialog
            :open="!!confirmRemoveMember"
            title="Remove member"
            :message="`Remove ${confirmRemoveMember?.user.email ?? 'this member'} from the organization?`"
            confirm-label="Remove"
            danger
            @update:open="confirmRemoveMember = null"
            @confirm="doRemoveMember"
        />
    </div>
</template>
