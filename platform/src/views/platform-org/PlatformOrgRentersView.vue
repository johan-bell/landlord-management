<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../lib/api';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';
import type { Paginated, Renter } from '../../types/models';

const route = useRoute();
const { orgApi } = usePlatformOrgContext();

const renters = ref<Renter[]>([]);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const showAdd = ref(false);
const copyMsg = ref<string | null>(null);
const form = ref({
    fullName: '',
    phone: '',
    email: '',
    initialPassword: '',
    initialPasswordConfirm: '',
});
const saving = ref(false);

const PAGE_SIZE = 20;

async function load() {
    loading.value = true;
    error.value = null;
    copyMsg.value = null;
    try {
        const qs = new URLSearchParams({
            page: String(page.value),
            limit: String(PAGE_SIZE),
        });
        if (search.value.trim()) qs.set('search', search.value.trim());
        const data = await api<Paginated<Renter>>(
            `${orgApi('/renters')}?${qs}`,
        );
        renters.value = data.items;
        totalPages.value = Math.max(1, data.totalPages);
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
    } finally {
        loading.value = false;
    }
}

function applySearch() {
    page.value = 1;
    void load();
}

async function copyTenantInvite(r: Renter) {
    copyMsg.value = null;
    try {
        const res = await api<{ registerUrl: string }>(
            orgApi(`/renters/${r.id}/tenant-invite`),
            {
                method: 'POST',
            },
        );
        await navigator.clipboard.writeText(res.registerUrl);
        copyMsg.value = 'Invite link copied for ' + r.fullName;
    } catch (e) {
        error.value =
            e instanceof Error ? e.message : 'Could not create invite';
    }
}

async function save() {
    const fullName = form.value.fullName.trim();
    if (!fullName) return;
    const pwd = form.value.initialPassword.trim();
    const pwd2 = form.value.initialPasswordConfirm.trim();
    if (pwd || pwd2) {
        if (pwd !== pwd2) {
            error.value = 'Passwords do not match';
            return;
        }
        if (pwd.length < 8) {
            error.value = 'Portal password must be at least 8 characters';
            return;
        }
        if (!form.value.email.trim()) {
            error.value = 'Email is required when setting a portal password';
            return;
        }
    }
    saving.value = true;
    error.value = null;
    try {
        const body: Record<string, string | undefined> = {
            fullName,
            phone: form.value.phone.trim() || undefined,
            email: form.value.email.trim() || undefined,
        };
        if (pwd) body.initialPassword = pwd;
        await api(orgApi('/renters'), {
            method: 'POST',
            body: JSON.stringify(body),
        });
        form.value = {
            fullName: '',
            phone: '',
            email: '',
            initialPassword: '',
            initialPasswordConfirm: '',
        };
        showAdd.value = false;
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Save failed';
    } finally {
        saving.value = false;
    }
}

async function remove(r: Renter) {
    if (!confirm(`Remove ${r.fullName} from this organization?`)) return;
    try {
        await api(orgApi(`/renters/${r.id}`), { method: 'DELETE' });
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Delete failed';
    }
}

onMounted(() => void load());
watch(
    () => route.params.orgId,
    () => void load(),
);
watch(page, () => void load());
</script>

<template>
    <div>
        <div
            class="mb-6 flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between"
        >
            <p class="text-sm text-slate-600">
                People who rent units under this organization.
            </p>
            <div class="flex flex-wrap items-center gap-2">
                <input
                    v-model="search"
                    type="search"
                    placeholder="Search name, email, phone…"
                    class="min-w-[200px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    @keydown.enter.prevent="applySearch"
                />
                <button
                    type="button"
                    class="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    @click="applySearch"
                >
                    Search
                </button>
            </div>
            <button
                type="button"
                class="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                @click="showAdd = true"
            >
                Add renter
            </button>
        </div>

        <p v-if="copyMsg" class="mb-2 text-sm text-emerald-700">
            {{ copyMsg }}
        </p>
        <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

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
            <table
                class="min-w-full divide-y divide-slate-200 text-left text-sm"
            >
                <thead
                    class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                    <tr>
                        <th class="px-4 py-3">Name</th>
                        <th class="hidden px-4 py-3 sm:table-cell">Phone</th>
                        <th class="hidden px-4 py-3 md:table-cell">Email</th>
                        <th class="hidden px-4 py-3 lg:table-cell">Portal</th>
                        <th class="px-4 py-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr
                        v-for="r in renters"
                        :key="r.id"
                        class="hover:bg-slate-50/80"
                    >
                        <td class="px-4 py-3 font-medium text-slate-900">
                            {{ r.fullName }}
                        </td>
                        <td
                            class="hidden px-4 py-3 text-slate-600 sm:table-cell"
                        >
                            {{ r.phone ?? '—' }}
                        </td>
                        <td
                            class="hidden px-4 py-3 text-slate-600 md:table-cell"
                        >
                            {{ r.email ?? '—' }}
                        </td>
                        <td class="hidden px-4 py-3 lg:table-cell">
                            <span
                                v-if="r.userId"
                                class="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200"
                            >
                                Active
                            </span>
                            <span v-else class="text-xs text-slate-400">—</span>
                        </td>
                        <td class="px-4 py-3 text-right">
                            <button
                                v-if="r.email && !r.userId"
                                type="button"
                                class="mr-3 text-sm font-medium text-indigo-600 hover:underline"
                                @click="copyTenantInvite(r)"
                            >
                                Copy invite
                            </button>
                            <button
                                type="button"
                                class="text-sm font-medium text-red-600 hover:underline"
                                @click="remove(r)"
                            >
                                Remove
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
            <p
                v-if="!renters.length"
                class="px-4 py-10 text-center text-sm text-slate-500"
            >
                No renters yet.
            </p>
        </div>

        <div
            v-if="!loading && totalPages > 1"
            class="mt-6 flex items-center justify-center gap-4 text-sm text-slate-600"
        >
            <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
                :disabled="page <= 1"
                @click="page--"
            >
                Previous
            </button>
            <span>Page {{ page }} / {{ totalPages }}</span>
            <button
                type="button"
                class="rounded-lg border border-slate-200 px-3 py-1.5 font-medium hover:bg-slate-50 disabled:opacity-40"
                :disabled="page >= totalPages"
                @click="page++"
            >
                Next
            </button>
        </div>

        <Teleport to="body">
            <div
                v-if="showAdd"
                class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
                @click.self="showAdd = false"
            >
                <div
                    class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                    @click.stop
                >
                    <h3 class="text-lg font-semibold">New renter</h3>
                    <label class="mt-4 block">
                        <span class="text-sm font-medium">Full name</span>
                        <input
                            v-model="form.fullName"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label class="mt-3 block">
                        <span class="text-sm font-medium"
                            >Phone (optional)</span
                        >
                        <input
                            v-model="form.phone"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label class="mt-3 block">
                        <span class="text-sm font-medium">Email</span>
                        <input
                            v-model="form.email"
                            type="email"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label class="mt-3 block">
                        <span class="text-sm font-medium"
                            >Initial portal password</span
                        >
                        <input
                            v-model="form.initialPassword"
                            type="password"
                            minlength="8"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <label class="mt-3 block">
                        <span class="text-sm font-medium"
                            >Confirm password</span
                        >
                        <input
                            v-model="form.initialPasswordConfirm"
                            type="password"
                            minlength="8"
                            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        />
                    </label>
                    <div class="mt-6 flex justify-end gap-2">
                        <button
                            type="button"
                            class="rounded-xl px-4 py-2 text-sm text-slate-600"
                            @click="showAdd = false"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            :disabled="saving || !form.fullName.trim()"
                            @click="save"
                        >
                            {{ saving ? 'Saving…' : 'Save' }}
                        </button>
                    </div>
                </div>
            </div>
        </Teleport>
    </div>
</template>
