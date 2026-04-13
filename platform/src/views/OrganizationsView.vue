<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../lib/api';

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

const loading = ref(true);
const error = ref<string | null>(null);
const rows = ref<OrgRow[]>([]);
const busyId = ref<string | null>(null);
const search = ref('');

const showCreate = ref(false);
const createName = ref('');
const createSlug = ref('');
const createSubmitting = ref(false);
const createError = ref<string | null>(null);

const filtered = computed(() => {
    const q = search.value.trim().toLowerCase();
    if (!q) return rows.value;
    return rows.value.filter(
        (o) =>
            o.name.toLowerCase().includes(q) ||
            (o.slug && o.slug.toLowerCase().includes(q)) ||
            o.id.toLowerCase().includes(q),
    );
});

const stats = computed(() => {
    const list = rows.value;
    const suspended = list.filter((o) => o.suspendedAt).length;
    return {
        total: list.length,
        suspended,
        active: list.length - suspended,
    };
});

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
        error.value =
            e instanceof Error ? e.message : 'Failed to load organizations';
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

async function createOrg() {
    const name = createName.value.trim();
    if (!name) return;
    createSubmitting.value = true;
    createError.value = null;
    try {
        const slug = createSlug.value.trim();
        const created = await api<{ id: string }>('/organizations', {
            method: 'POST',
            body: JSON.stringify({
                name,
                ...(slug ? { slug } : {}),
            }),
        });
        showCreate.value = false;
        createName.value = '';
        createSlug.value = '';
        await load();
        await router.push(`/organization/${created.id}`);
    } catch (e) {
        createError.value =
            e instanceof Error ? e.message : 'Could not create organization';
    } finally {
        createSubmitting.value = false;
    }
}

onMounted(() => {
    void load();
});
</script>

<template>
    <div>
        <div
            class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
        >
            <div>
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">
                    Organizations
                </h1>
                <p class="mt-1 text-sm text-slate-600">
                    Search, open an organization, suspend access, or bootstrap a
                    new org (you become the first owner).
                </p>
            </div>
            <button
                type="button"
                class="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:bg-indigo-700"
                @click="showCreate = true"
            >
                New organization
            </button>
        </div>

        <p
            v-if="error"
            class="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
            {{ error }}
        </p>

        <div v-if="!loading" class="mb-6 grid gap-3 sm:grid-cols-3">
            <div
                class="rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm"
            >
                <p
                    class="text-xs font-medium uppercase tracking-wide text-slate-500"
                >
                    Total
                </p>
                <p class="mt-1 text-2xl font-bold text-slate-900">
                    {{ stats.total }}
                </p>
            </div>
            <div
                class="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-sm"
            >
                <p
                    class="text-xs font-medium uppercase tracking-wide text-emerald-800"
                >
                    Active
                </p>
                <p class="mt-1 text-2xl font-bold text-emerald-950">
                    {{ stats.active }}
                </p>
            </div>
            <div
                class="rounded-2xl border border-red-100 bg-red-50/60 p-4 shadow-sm"
            >
                <p
                    class="text-xs font-medium uppercase tracking-wide text-red-800"
                >
                    Suspended
                </p>
                <p class="mt-1 text-2xl font-bold text-red-950">
                    {{ stats.suspended }}
                </p>
            </div>
        </div>

        <div
            class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
            <label class="block max-w-md flex-1 text-sm">
                <span class="sr-only">Search</span>
                <input
                    v-model="search"
                    type="search"
                    placeholder="Search by name, slug, or ID…"
                    class="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </label>
            <button
                type="button"
                class="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
                @click="load()"
            >
                Refresh
            </button>
        </div>

        <div
            v-if="loading"
            class="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-600 shadow-sm"
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
                            <th class="px-4 py-3">Name</th>
                            <th class="hidden px-4 py-3 sm:table-cell">Open</th>
                            <th class="px-4 py-3">Status</th>
                            <th class="hidden px-4 py-3 md:table-cell">
                                Subscription
                            </th>
                            <th class="hidden px-4 py-3 lg:table-cell">
                                Counts
                            </th>
                            <th class="px-4 py-3">Suspended</th>
                            <th class="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        <tr
                            v-for="org in filtered"
                            :key="org.id"
                            class="hover:bg-slate-50/50"
                        >
                            <td class="px-4 py-3 font-medium text-slate-900">
                                {{ org.name }}
                                <span
                                    v-if="org.slug"
                                    class="mt-0.5 block text-xs font-normal text-slate-500"
                                    >{{ org.slug }}</span
                                >
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
                                    :class="
                                        org.suspendedAt
                                            ? 'bg-red-100 text-red-800'
                                            : 'bg-emerald-100 text-emerald-800'
                                    "
                                >
                                    {{
                                        org.suspendedAt ? 'Suspended' : 'Active'
                                    }}
                                </span>
                            </td>
                            <td
                                class="hidden px-4 py-3 text-slate-600 md:table-cell"
                            >
                                {{ org.subscriptionStatus }}
                            </td>
                            <td
                                class="hidden px-4 py-3 text-xs text-slate-600 lg:table-cell"
                            >
                                {{ org._count.members }} members ·
                                {{ org._count.properties }} props ·
                                {{ org._count.renters }} renters
                            </td>
                            <td class="px-4 py-3 text-xs text-slate-500">
                                {{ formatDate(org.suspendedAt) }}
                            </td>
                            <td class="px-4 py-3 text-right">
                                <button
                                    type="button"
                                    class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                    :disabled="busyId === org.id"
                                    @click="toggleSuspend(org)"
                                >
                                    {{
                                        org.suspendedAt
                                            ? 'Unsuspend'
                                            : 'Suspend'
                                    }}
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p
                v-if="!loading && filtered.length === 0"
                class="px-4 py-8 text-center text-sm text-slate-500"
            >
                {{
                    search.trim()
                        ? 'No organizations match your search.'
                        : 'No organizations yet.'
                }}
            </p>
        </div>

        <div
            v-if="showCreate"
            class="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
            role="dialog"
            aria-modal="true"
            @click.self="showCreate = false"
        >
            <div
                class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
            >
                <h2 class="text-lg font-semibold text-slate-900">
                    New organization
                </h2>
                <p class="mt-1 text-sm text-slate-600">
                    Creates the org and adds your platform account as
                    <strong>Owner</strong>. Use for demos or when onboarding a
                    customer; you can invite their staff afterward.
                </p>
                <form class="mt-4 space-y-3" @submit.prevent="createOrg">
                    <label class="block text-sm">
                        <span class="text-slate-700">Name</span>
                        <input
                            v-model="createName"
                            required
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label class="block text-sm">
                        <span class="text-slate-700">Slug (optional)</span>
                        <input
                            v-model="createSlug"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            placeholder="acme-rentals"
                        />
                    </label>
                    <p v-if="createError" class="text-sm text-red-600">
                        {{ createError }}
                    </p>
                    <div class="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            @click="showCreate = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                            :disabled="createSubmitting"
                        >
                            {{ createSubmitting ? 'Creating…' : 'Create' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>
