<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../lib/api';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';

type OrgDetail = {
    id: string;
    name: string;
    slug: string | null;
    createdAt: string;
    suspendedAt: string | null;
    subscriptionStatus: string;
    members?: unknown[];
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
const { orgId, orgApi } = usePlatformOrgContext();

const reloadOrgTitle = inject<() => Promise<void>>('reloadOrgTitle');

const loading = ref(true);
const error = ref<string | null>(null);
const org = ref<OrgDetail | null>(null);

const editName = ref('');
const editSlug = ref('');
const savingMeta = ref(false);
const metaError = ref<string | null>(null);

const suspendBusy = ref(false);
const deleteBusy = ref(false);

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
        const body: { name: string; slug?: string } = {
            name: editName.value.trim(),
        };
        if (slug) body.slug = slug;
        await api(orgApi(''), {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
        await loadOrg();
        await reloadOrgTitle?.();
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

onMounted(() => void loadOrg());
watch(
    () => route.params.orgId,
    () => void loadOrg(),
);
</script>

<template>
    <div>
        <div
            v-if="loading"
            class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
        >
            Loading…
        </div>
        <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

        <template v-else-if="org">
            <div class="flex flex-wrap items-center gap-3">
                <span
                    class="inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                    :class="
                        org.suspendedAt
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                    "
                >
                    {{ org.suspendedAt ? 'Suspended' : 'Active' }}
                </span>
                <span class="text-xs text-slate-500"
                    >Subscription {{ org.subscriptionStatus }}</span
                >
            </div>

            <div class="mt-8 grid gap-4 lg:grid-cols-2">
                <div
                    class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <h2 class="text-sm font-semibold text-slate-900">
                        Organization details
                    </h2>
                    <p class="mt-1 text-xs text-slate-500">
                        Same fields as the landlord admin.
                    </p>
                    <form class="mt-4 space-y-3" @submit.prevent="saveMeta">
                        <label class="block text-sm">
                            <span class="text-slate-700">Name</span>
                            <input
                                v-model="editName"
                                required
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>
                        <label class="block text-sm">
                            <span class="text-slate-700">Slug</span>
                            <input
                                v-model="editSlug"
                                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                            />
                        </label>
                        <p v-if="metaError" class="text-sm text-red-600">
                            {{ metaError }}
                        </p>
                        <button
                            type="submit"
                            class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                            :disabled="savingMeta"
                        >
                            {{ savingMeta ? 'Saving…' : 'Save changes' }}
                        </button>
                    </form>
                </div>

                <div
                    class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                    <h2 class="text-sm font-semibold text-slate-900">
                        Danger zone
                    </h2>
                    <p class="mt-1 text-xs text-slate-500">
                        Suspend blocks landlord staff; delete removes all org
                        data.
                    </p>
                    <div class="mt-4 flex flex-wrap gap-2">
                        <button
                            type="button"
                            class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                            :disabled="suspendBusy"
                            @click="toggleSuspend"
                        >
                            {{
                                suspendBusy
                                    ? '…'
                                    : org.suspendedAt
                                      ? 'Unsuspend organization'
                                      : 'Suspend organization'
                            }}
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

            <div class="mt-10">
                <h2
                    class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500"
                >
                    Diagnostics
                </h2>
                <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <div
                        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <p class="text-xs text-slate-500">Members</p>
                        <p class="text-2xl font-semibold text-slate-900">
                            {{ org.diagnostics.members }}
                        </p>
                    </div>
                    <div
                        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <p class="text-xs text-slate-500">Properties</p>
                        <p class="text-2xl font-semibold text-slate-900">
                            {{ org.diagnostics.properties }}
                        </p>
                    </div>
                    <div
                        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <p class="text-xs text-slate-500">Units</p>
                        <p class="text-2xl font-semibold text-slate-900">
                            {{ org.diagnostics.units }}
                        </p>
                    </div>
                    <div
                        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <p class="text-xs text-slate-500">Renters</p>
                        <p class="text-2xl font-semibold text-slate-900">
                            {{ org.diagnostics.renters }}
                        </p>
                    </div>
                    <div
                        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <p class="text-xs text-slate-500">Leases</p>
                        <p class="text-2xl font-semibold text-slate-900">
                            {{ org.diagnostics.leases }}
                        </p>
                    </div>
                    <div
                        class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                        <p class="text-xs text-slate-500">
                            Pending org invites
                        </p>
                        <p class="text-2xl font-semibold text-slate-900">
                            {{ org.diagnostics.pendingInvitations }}
                        </p>
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>
