<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import { useOrgStore } from '../stores/org';
import { useToastStore } from '../stores/toast';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

type SupportRow = {
    id: string;
    subject: string;
    message: string;
    status: string;
    category: string;
    urgency: string;
    fromTenant: boolean;
    createdAt: string;
    updatedAt: string;
    closedAt: string | null;
    resolutionNote: string | null;
    submitter: { id: string; email: string | null; name: string | null };
    organization: { id: string; name: string } | null;
    handledBy: { id: string; email: string | null; name: string | null } | null;
};

const { hasOrg, orgApi, selectedOrgId } = useOrgContext();
const orgStore = useOrgStore();
const { selectedOrgMyRole } = storeToRefs(orgStore);
const toast = useToastStore();

const canManageSupport = computed(
    () =>
        selectedOrgMyRole.value === 'OWNER' ||
        selectedOrgMyRole.value === 'MANAGER',
);

const loading = ref(true);
const creating = ref(false);
const error = ref<string | null>(null);
const formError = ref<string | null>(null);
const rows = ref<SupportRow[]>([]);

const filterStatus = ref('');
const filterSearch = ref('');
const statusOptions = ['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const createOpen = ref(false);
const newSubject = ref('');
const newMessage = ref('');

const detail = ref<SupportRow | null>(null);
const editStatus = ref('');
const editNote = ref('');
const savingId = ref<string | null>(null);

function filteredRows() {
    const q = filterSearch.value.trim().toLowerCase();
    return rows.value.filter((r) => {
        if (filterStatus.value && r.status !== filterStatus.value) return false;
        if (
            q &&
            !`${r.subject} ${r.message} ${r.category} ${r.urgency} ${categoryLabel(r.category)} ${urgencyLabel(r.urgency)}`
                .toLowerCase()
                .includes(q)
        ) {
            return false;
        }
        return true;
    });
}

function categoryLabel(c: string) {
    if (c === 'MAINTENANCE') return 'Maintenance';
    if (c === 'BILLING') return 'Billing';
    if (c === 'GENERAL') return 'General';
    if (c === 'OTHER') return 'Other';
    return c;
}

function urgencyLabel(u: string) {
    if (u === 'LOW') return 'Low';
    if (u === 'NORMAL') return 'Normal';
    if (u === 'HIGH') return 'High';
    return u;
}

function urgencyClass(u: string) {
    if (u === 'HIGH') return 'bg-red-50 text-red-800 ring-red-200';
    if (u === 'LOW') return 'bg-slate-100 text-slate-700 ring-slate-200';
    return 'bg-violet-50 text-violet-800 ring-violet-200';
}

function statusLabel(s: string) {
    if (s === 'IN_PROGRESS') return 'In progress';
    return s.charAt(0) + s.slice(1).toLowerCase();
}

function statusClass(s: string) {
    if (s === 'OPEN') return 'bg-blue-50 text-blue-800 ring-blue-200';
    if (s === 'IN_PROGRESS') return 'bg-amber-50 text-amber-800 ring-amber-200';
    if (s === 'RESOLVED') return 'bg-emerald-50 text-emerald-800 ring-emerald-200';
    if (s === 'CLOSED') return 'bg-slate-100 text-slate-600 ring-slate-200';
    return 'bg-slate-100 text-slate-700 ring-slate-200';
}

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        rows.value = await api<SupportRow[]>(orgApi('/support-requests'));
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
        rows.value = [];
    } finally {
        loading.value = false;
    }
}

function openCreate() {
    formError.value = null;
    newSubject.value = '';
    newMessage.value = '';
    createOpen.value = true;
}

function closeCreate() {
    createOpen.value = false;
}

async function submitCreate() {
    formError.value = null;
    const subject = newSubject.value.trim();
    const message = newMessage.value.trim();
    if (!subject || !message) {
        formError.value = 'Subject and message are required.';
        return;
    }
    creating.value = true;
    try {
        await api<SupportRow>(orgApi('/support-requests'), {
            method: 'POST',
            body: JSON.stringify({ subject, message }),
        });
        closeCreate();
        toast.success('Support request sent');
        await load();
    } catch (e) {
        formError.value = e instanceof Error ? e.message : 'Failed to send';
    } finally {
        creating.value = false;
    }
}

function openDetail(row: SupportRow) {
    detail.value = row;
    editStatus.value = row.status;
    editNote.value = row.resolutionNote ?? '';
}

function closeDetail() {
    detail.value = null;
    savingId.value = null;
}

async function saveSupportDetail() {
    if (!detail.value || !canManageSupport.value) return;
    savingId.value = detail.value.id;
    try {
        await api<SupportRow>(
            orgApi(`/support-requests/${detail.value.id}`),
            {
                method: 'PATCH',
                body: JSON.stringify({
                    status: editStatus.value || undefined,
                    resolutionNote: editNote.value,
                }),
            },
        );
        toast.success('Ticket updated');
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
        toast.error(e instanceof Error ? e.message : 'Update failed');
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

onMounted(() => void load());
watch([hasOrg, selectedOrgId], () => void load());
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <div
                class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
            >
                <div>
                    <h2 class="text-xl font-semibold text-slate-900">
                        Support requests
                    </h2>
                    <p class="mt-1 max-w-prose text-sm text-slate-600">
                        Tickets from renters in your organization and messages
                        your team sends to the platform. The owner or a manager
                        can set status and resolution here; the platform team
                        can also. Renters see the resolution note when a ticket
                        is closed or resolved.
                    </p>
                </div>
                <button
                    type="button"
                    class="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                    @click="openCreate"
                >
                    New request to platform
                </button>
            </div>

            <p
                v-if="error"
                class="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
                {{ error }}
            </p>

            <div class="mb-4 flex flex-wrap items-center gap-3">
                <label class="flex min-w-48 flex-1 items-center gap-2 text-sm">
                    <span class="shrink-0 font-medium text-slate-700">Search</span>
                        <input
                        v-model="filterSearch"
                        type="search"
                        placeholder="Subject, message, category, urgency…"
                        class="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-900"
                    />
                </label>
                <label class="flex items-center gap-2 text-sm">
                    <span class="font-medium text-slate-700">Status</span>
                    <select
                        v-model="filterStatus"
                        class="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
                    >
                        <option
                            v-for="s in statusOptions"
                            :key="s || 'all'"
                            :value="s"
                        >
                            {{ s ? statusLabel(s) : 'All' }}
                        </option>
                    </select>
                </label>
            </div>

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
                    <table class="min-w-full text-left text-sm">
                        <thead
                            class="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                            <tr>
                                <th class="px-4 py-3">Subject</th>
                                <th
                                    class="hidden px-4 py-3 sm:table-cell"
                                >
                                    Category
                                </th>
                                <th
                                    class="hidden px-4 py-3 sm:table-cell"
                                >
                                    Urgency
                                </th>
                                <th class="px-4 py-3">From</th>
                                <th class="px-4 py-3">Status</th>
                                <th class="hidden px-4 py-3 lg:table-cell">
                                    Created
                                </th>
                                <th class="px-4 py-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            <tr
                                v-for="row in filteredRows()"
                                :key="row.id"
                                class="hover:bg-slate-50/50"
                            >
                                <td class="max-w-xs px-4 py-3">
                                    <p
                                        class="truncate font-medium text-slate-900"
                                    >
                                        {{ row.subject }}
                                    </p>
                                    <p
                                        class="line-clamp-2 text-xs text-slate-500"
                                    >
                                        {{ row.message }}
                                    </p>
                                </td>
                                <td
                                    class="hidden px-4 py-3 text-sm text-slate-800 sm:table-cell"
                                >
                                    {{ categoryLabel(row.category) }}
                                </td>
                                <td class="hidden px-4 py-3 sm:table-cell">
                                    <span
                                        class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                                        :class="urgencyClass(row.urgency)"
                                    >
                                        {{ urgencyLabel(row.urgency) }}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-xs text-slate-700">
                                    {{ row.fromTenant ? 'Renter' : 'Staff' }}
                                    <span
                                        class="mt-0.5 block truncate text-slate-500"
                                        >{{ row.submitter.email }}</span
                                    >
                                </td>
                                <td class="px-4 py-3">
                                    <span
                                        class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                                        :class="statusClass(row.status)"
                                    >
                                        {{ statusLabel(row.status) }}
                                    </span>
                                </td>
                                <td
                                    class="hidden px-4 py-3 text-xs text-slate-500 lg:table-cell"
                                >
                                    {{ formatDate(row.createdAt) }}
                                </td>
                                <td class="px-4 py-3 text-right">
                                    <button
                                        type="button"
                                        class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                        @click="openDetail(row)"
                                    >
                                        {{ canManageSupport ? 'Manage' : 'View' }}
                                    </button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div
                    v-if="!loading && !filteredRows().length"
                    class="px-4 py-10 text-center"
                >
                    <p class="text-sm font-medium text-slate-700">
                        {{ filterSearch || filterStatus ? 'No tickets match your filters' : 'No support requests yet' }}
                    </p>
                    <p class="mt-1 text-xs text-slate-500">
                        {{ filterSearch || filterStatus ? 'Try clearing the search or status filter.' : 'Tickets from renters and your team to the platform will appear here.' }}
                    </p>
                </div>
            </div>
        </template>

        <div
            v-if="createOpen"
            class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            @click.self="closeCreate"
        >
            <div
                class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
                <div class="flex items-start justify-between gap-3">
                    <h3 class="text-lg font-semibold text-slate-900">
                        Message platform support
                    </h3>
                    <button
                        type="button"
                        class="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                        @click="closeCreate"
                    >
                        Close
                    </button>
                </div>
                <p class="mt-2 text-xs leading-relaxed text-slate-500">
                    This opens a ticket for the SaaS operator (billing,
                    technical issues, suspension appeals). For everyday property
                    matters, coordinate with your renters directly.
                </p>
                <form class="mt-4 space-y-3" @submit.prevent="submitCreate">
                    <label class="block text-sm">
                        <span class="text-slate-700">Subject</span>
                        <input
                            v-model="newSubject"
                            type="text"
                            required
                            maxlength="200"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                    </label>
                    <label class="block text-sm">
                        <span class="text-slate-700">Message</span>
                        <textarea
                            v-model="newMessage"
                            required
                            rows="4"
                            maxlength="8000"
                            class="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        />
                    </label>
                    <p v-if="formError" class="text-sm text-red-600">
                        {{ formError }}
                    </p>
                    <div class="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            @click="closeCreate"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            :disabled="creating"
                        >
                            {{ creating ? 'Sending…' : 'Send' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div
            v-if="detail"
            class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            @click.self="closeDetail"
        >
            <div
                class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
                <div class="flex items-start justify-between gap-3">
                    <div>
                        <p
                            class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                            Ticket
                        </p>
                        <h2 class="mt-1 text-lg font-semibold text-slate-900">
                            {{ detail.subject }}
                        </h2>
                    </div>
                    <button
                        type="button"
                        class="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                        @click="closeDetail"
                    >
                        Close
                    </button>
                </div>
                <p class="mt-3 whitespace-pre-wrap text-sm text-slate-700">
                    {{ detail.message }}
                </p>
                <dl
                    class="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"
                >
                    <div class="flex justify-between gap-2">
                        <dt>From</dt>
                        <dd class="text-right">
                            {{ detail.fromTenant ? 'Renter' : 'Staff' }} ·
                            {{ detail.submitter.email }}
                        </dd>
                    </div>
                    <div class="flex justify-between gap-2">
                        <dt>Category</dt>
                        <dd class="text-right">
                            {{ categoryLabel(detail.category) }}
                        </dd>
                    </div>
                    <div class="flex justify-between gap-2">
                        <dt>Urgency</dt>
                        <dd class="text-right">
                            <span
                                class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                                :class="urgencyClass(detail.urgency)"
                            >
                                {{ urgencyLabel(detail.urgency) }}
                            </span>
                        </dd>
                    </div>
                    <div class="flex justify-between gap-2">
                        <dt>Status</dt>
                        <dd class="text-right font-medium text-slate-800">
                            {{ detail.status }}
                        </dd>
                    </div>
                    <div class="flex justify-between gap-2">
                        <dt>Created</dt>
                        <dd class="text-right">
                            {{ formatDate(detail.createdAt) }}
                        </dd>
                    </div>
                    <div
                        v-if="detail.handledBy"
                        class="flex justify-between gap-2"
                    >
                        <dt>Last updated by</dt>
                        <dd class="text-right">
                            {{ detail.handledBy.email }}
                        </dd>
                    </div>
                    <div
                        v-if="detail.closedAt"
                        class="flex justify-between gap-2"
                    >
                        <dt>Closed</dt>
                        <dd class="text-right">
                            {{ formatDate(detail.closedAt) }}
                        </dd>
                    </div>
                </dl>
                <div
                    v-if="detail.resolutionNote"
                    class="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/80 p-3 text-sm"
                >
                    <p
                        class="text-xs font-semibold uppercase tracking-wide text-emerald-800"
                    >
                        Platform resolution
                    </p>
                    <p class="mt-1 whitespace-pre-wrap text-emerald-950">
                        {{ detail.resolutionNote }}
                    </p>
                    <p class="mt-2 text-xs text-emerald-800/80">
                        This text is also visible to the renter when the ticket
                        is resolved or closed.
                    </p>
                </div>
                <p
                    v-else-if="
                        detail.status === 'RESOLVED' ||
                        detail.status === 'CLOSED'
                    "
                    class="mt-4 text-xs text-slate-500"
                >
                    No resolution note was added by the platform team.
                </p>

                <p
                    v-if="!canManageSupport"
                    class="mt-4 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600"
                >
                    Only an <strong>owner</strong> or <strong>manager</strong>
                    can change status or the resolution note. Ask the portfolio
                    lead if you need an update.
                </p>
                <div
                    v-else
                    class="mt-6 space-y-3 border-t border-slate-200 pt-4"
                >
                    <h3
                        class="text-sm font-semibold text-slate-900"
                    >
                        Update ticket
                    </h3>
                    <label class="block text-sm">
                        <span class="text-slate-700">Status</span>
                        <select
                            v-model="editStatus"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                        >
                            <option value="OPEN">Open</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="RESOLVED">Resolved</option>
                            <option value="CLOSED">Closed</option>
                        </select>
                    </label>
                    <label class="block text-sm">
                        <span class="text-slate-700">Resolution note</span>
                        <textarea
                            v-model="editNote"
                            rows="4"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                            placeholder="Visible to the renter when status is resolved or closed…"
                        />
                    </label>
                    <div class="flex justify-end gap-2">
                        <button
                            type="button"
                            class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            @click="closeDetail"
                        >
                            Close
                        </button>
                        <button
                            type="button"
                            class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                            :disabled="savingId === detail.id"
                            @click="saveSupportDetail"
                        >
                            {{ savingId === detail.id ? 'Saving…' : 'Save' }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
