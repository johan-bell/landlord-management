<script setup lang="ts">
import { BuildingOffice2Icon } from '@heroicons/vue/24/outline';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import { formatMoney } from '../composables/format';
import type { Paginated, Property, Unit } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();

const rows = ref<(Property & { units?: Unit[] })[]>([]);
const page = ref(1);
const totalPages = ref(1);
const search = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const successHint = ref<string | null>(null);

const showAdd = ref(false);
const newName = ref('');
const newAddress = ref('');
const addSaving = ref(false);

const editing = ref<Property | null>(null);
const editName = ref('');
const editAddress = ref('');
const editSaving = ref(false);
const editDeleting = ref(false);

const PAGE_SIZE = 12;

let successTimer: ReturnType<typeof setTimeout> | null = null;
function flashSuccess(message: string) {
    successHint.value = message;
    if (successTimer) clearTimeout(successTimer);
    successTimer = setTimeout(() => {
        successHint.value = null;
        successTimer = null;
    }, 3200);
}

async function load() {
    if (!hasOrg.value) return;
    loading.value = true;
    error.value = null;
    try {
        const qs = new URLSearchParams({
            page: String(page.value),
            limit: String(PAGE_SIZE),
        });
        if (search.value.trim()) qs.set('search', search.value.trim());
        const data = await api<Paginated<Property>>(
            `${orgApi('/properties')}?${qs}`,
        );
        totalPages.value = Math.max(1, data.totalPages);
        const withUnits = await Promise.all(
            data.items.map(async (p) => {
                const ures = await api<Paginated<Unit>>(
                    `${orgApi(`/properties/${p.id}/units`)}?limit=100`,
                );
                return { ...p, units: ures.items };
            }),
        );
        rows.value = withUnits;
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

async function addProperty() {
    const name = newName.value.trim();
    if (!name) return;
    addSaving.value = true;
    try {
        await api(orgApi('/properties'), {
            method: 'POST',
            body: JSON.stringify({
                name,
                address: newAddress.value.trim() || undefined,
            }),
        });
        newName.value = '';
        newAddress.value = '';
        showAdd.value = false;
        flashSuccess('Property created');
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Save failed';
    } finally {
        addSaving.value = false;
    }
}

function openEdit(p: Property) {
    editing.value = p;
    editName.value = p.name;
    editAddress.value = p.address ?? '';
}

function closeEdit() {
    editing.value = null;
}

async function saveEdit() {
    const p = editing.value;
    if (!p || !editName.value.trim()) return;
    editSaving.value = true;
    try {
        await api(orgApi(`/properties/${p.id}`), {
            method: 'PATCH',
            body: JSON.stringify({
                name: editName.value.trim(),
                address: editAddress.value.trim(),
            }),
        });
        closeEdit();
        flashSuccess('Property updated');
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Update failed';
    } finally {
        editSaving.value = false;
    }
}

async function deleteFromEdit() {
    const p = editing.value;
    if (!p) return;
    if (
        !confirm(
            `Delete “${p.name}” and all its units? This cannot be undone.`,
        )
    ) {
        return;
    }
    editDeleting.value = true;
    try {
        await api(orgApi(`/properties/${p.id}`), { method: 'DELETE' });
        closeEdit();
        flashSuccess('Property removed');
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Delete failed';
    } finally {
        editDeleting.value = false;
    }
}

async function removeProperty(p: Property) {
    if (
        !confirm(`Delete “${p.name}” and all its units? This cannot be undone.`)
    ) {
        return;
    }
    try {
        await api(orgApi(`/properties/${p.id}`), { method: 'DELETE' });
        flashSuccess('Property removed');
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Delete failed';
    }
}

function formatShortDate(iso: string | undefined) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (showAdd.value) showAdd.value = false;
    if (editing.value) closeEdit();
}

onMounted(() => {
    void load();
    window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown);
    if (successTimer) clearTimeout(successTimer);
});

watch(hasOrg, () => {
    void load();
});

watch(page, () => {
    void load();
});
</script>

<template>
    <div>
        <SelectOrgPrompt v-if="!hasOrg" />

        <template v-else>
            <div class="mb-8">
                <h1 class="text-2xl font-bold tracking-tight text-slate-900">
                    Properties
                </h1>
                <p class="mt-1 max-w-2xl text-sm text-slate-600">
                    Buildings and sites in this organization. Edit names and
                    addresses anytime; open a property to manage units and rent.
                </p>
            </div>

            <div
                class="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            >
                <div class="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 sm:max-w-xl">
                    <input
                        v-model="search"
                        type="search"
                        placeholder="Search by name or address…"
                        class="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        @keydown.enter.prevent="applySearch"
                    />
                    <button
                        type="button"
                        class="shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        @click="applySearch"
                    >
                        Search
                    </button>
                </div>
                <button
                    type="button"
                    class="inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 sm:w-auto"
                    @click="showAdd = true"
                >
                    Add property
                </button>
            </div>

            <div
                v-if="successHint"
                class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
                role="status"
            >
                {{ successHint }}
            </div>
            <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

            <div
                v-if="loading"
                class="space-y-4"
                aria-busy="true"
            >
                <div
                    v-for="n in 4"
                    :key="n"
                    class="h-36 animate-pulse rounded-2xl bg-slate-100/90"
                />
            </div>

            <div
                v-else-if="!rows.length"
                class="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 py-20 text-center"
            >
                <div
                    class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    aria-hidden="true"
                >
                    <BuildingOffice2Icon class="h-7 w-7" aria-hidden="true" />
                </div>
                <p class="mt-4 font-medium text-slate-900">No properties yet</p>
                <p class="mx-auto mt-1 max-w-sm text-sm text-slate-600">
                    Create a property for each building or site, then add units
                    and leases.
                </p>
                <button
                    type="button"
                    class="mt-6 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
                    @click="showAdd = true"
                >
                    Add your first property
                </button>
            </div>

            <div v-else class="grid gap-5 sm:grid-cols-1 lg:grid-cols-2">
                <article
                    v-for="p in rows"
                    :key="p.id"
                    class="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-transparent transition hover:border-emerald-200/80 hover:shadow-md hover:ring-emerald-100/50"
                >
                    <div
                        class="flex flex-1 flex-col border-l-4 border-emerald-500 p-5"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0 flex-1">
                                <h2
                                    class="text-lg font-semibold leading-snug text-slate-900"
                                >
                                    {{ p.name }}
                                </h2>
                                <p
                                    v-if="p.address"
                                    class="mt-1.5 text-sm leading-relaxed text-slate-600"
                                >
                                    {{ p.address }}
                                </p>
                                <p
                                    v-else
                                    class="mt-1.5 text-sm italic text-slate-400"
                                >
                                    No address on file
                                </p>
                                <p
                                    v-if="formatShortDate(p.createdAt)"
                                    class="mt-2 text-xs text-slate-400"
                                >
                                    Added {{ formatShortDate(p.createdAt) }}
                                </p>
                            </div>
                            <span
                                class="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tabular-nums text-slate-700"
                            >
                                {{ p.units?.length ?? 0 }}
                                {{ (p.units?.length ?? 0) === 1 ? 'unit' : 'units' }}
                            </span>
                        </div>

                        <div
                            class="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4"
                        >
                            <button
                                type="button"
                                class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                                @click="openEdit(p)"
                            >
                                Edit details
                            </button>
                            <RouterLink
                                :to="`/properties/${p.id}/units`"
                                class="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
                            >
                                Manage units
                            </RouterLink>
                            <button
                                type="button"
                                class="ml-auto text-sm font-medium text-slate-500 underline-offset-2 hover:text-red-600 hover:underline sm:ml-0"
                                @click="removeProperty(p)"
                            >
                                Delete
                            </button>
                        </div>
                    </div>

                    <div
                        v-if="p.units?.length"
                        class="border-t border-slate-100 bg-slate-50/90 px-5 py-4"
                    >
                        <p
                            class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                        >
                            Units preview
                        </p>
                        <ul class="mt-2 space-y-2">
                            <li
                                v-for="u in p.units!.slice(0, 4)"
                                :key="u.id"
                                class="flex items-center justify-between gap-3 text-sm"
                            >
                                <span class="truncate text-slate-700">{{
                                    u.label
                                }}</span>
                                <span
                                    class="shrink-0 tabular-nums font-medium text-slate-900"
                                    >{{
                                        formatMoney(u.rentAmount, u.currency)
                                    }}</span
                                >
                            </li>
                            <li
                                v-if="(p.units?.length ?? 0) > 4"
                                class="text-xs text-slate-500"
                            >
                                + {{ (p.units?.length ?? 0) - 4 }} more — open
                                property for full list
                            </li>
                        </ul>
                    </div>
                </article>
            </div>

            <div
                v-if="!loading && totalPages > 1"
                class="mt-10 flex items-center justify-center gap-4 text-sm text-slate-600"
            >
                <button
                    type="button"
                    class="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium shadow-sm hover:bg-slate-50 disabled:opacity-40"
                    :disabled="page <= 1"
                    @click="page--"
                >
                    Previous
                </button>
                <span class="tabular-nums">Page {{ page }} / {{ totalPages }}</span>
                <button
                    type="button"
                    class="rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium shadow-sm hover:bg-slate-50 disabled:opacity-40"
                    :disabled="page >= totalPages"
                    @click="page++"
                >
                    Next
                </button>
            </div>

            <Teleport to="body">
                <div
                    v-if="showAdd"
                    class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-property-title"
                    @click.self="showAdd = false"
                >
                    <div
                        class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        @click.stop
                    >
                        <h3
                            id="add-property-title"
                            class="text-lg font-semibold text-slate-900"
                        >
                            New property
                        </h3>
                        <p class="mt-1 text-sm text-slate-500">
                            A building or site that contains rentable units.
                        </p>
                        <label class="mt-5 block">
                            <span class="text-sm font-medium text-slate-700"
                                >Name</span
                            >
                            <input
                                v-model="newName"
                                type="text"
                                autocomplete="organization"
                                class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Résidence Akwa"
                            />
                        </label>
                        <label class="mt-4 block">
                            <span class="text-sm font-medium text-slate-700"
                                >Address <span class="font-normal text-slate-500">(optional)</span></span
                            >
                            <input
                                v-model="newAddress"
                                type="text"
                                autocomplete="street-address"
                                class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Street, city, region"
                            />
                        </label>
                        <div class="mt-6 flex justify-end gap-2">
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                                @click="showAdd = false"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                :disabled="addSaving || !newName.trim()"
                                @click="addProperty"
                            >
                                {{ addSaving ? 'Saving…' : 'Create property' }}
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>

            <Teleport to="body">
                <div
                    v-if="editing"
                    class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-[2px] sm:items-center sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="edit-property-title"
                    @click.self="closeEdit"
                >
                    <div
                        class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        @click.stop
                    >
                        <h3
                            id="edit-property-title"
                            class="text-lg font-semibold text-slate-900"
                        >
                            Edit property
                        </h3>
                        <p class="mt-1 text-sm text-slate-500">
                            Changes apply immediately for your team and reports.
                        </p>
                        <label class="mt-5 block">
                            <span class="text-sm font-medium text-slate-700"
                                >Name</span
                            >
                            <input
                                v-model="editName"
                                type="text"
                                autocomplete="organization"
                                class="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                        </label>
                        <label class="mt-4 block">
                            <span class="text-sm font-medium text-slate-700"
                                >Address</span
                            >
                            <textarea
                                v-model="editAddress"
                                rows="2"
                                class="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                placeholder="Leave empty to clear"
                            />
                            <span class="mt-1 block text-xs text-slate-500"
                                >Clear the field to remove the stored address.</span
                            >
                        </label>
                        <div class="mt-6 flex flex-wrap items-center justify-end gap-2">
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                                :disabled="editSaving || editDeleting"
                                @click="closeEdit"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                                :disabled="
                                    editSaving ||
                                    editDeleting ||
                                    !editName.trim()
                                "
                                @click="saveEdit"
                            >
                                {{ editSaving ? 'Saving…' : 'Save changes' }}
                            </button>
                        </div>

                        <div
                            class="mt-8 border-t border-slate-100 pt-6"
                        >
                            <p class="text-xs font-semibold uppercase tracking-wide text-red-600/90">
                                Danger zone
                            </p>
                            <p class="mt-1 text-sm text-slate-600">
                                Deleting removes this property and all its units.
                                Leases tied to those units may block deletion —
                                resolve them first if the API reports an error.
                            </p>
                            <button
                                type="button"
                                class="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50"
                                :disabled="editSaving || editDeleting"
                                @click="deleteFromEdit"
                            >
                                {{
                                    editDeleting ? 'Deleting…' : 'Delete property'
                                }}
                            </button>
                        </div>
                    </div>
                </div>
            </Teleport>
        </template>
    </div>
</template>
