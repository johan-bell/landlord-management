<script setup lang="ts">
import { inject, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../../lib/api';
import { platformFeatures } from '../../config/features';
import { formatMoney } from '../../composables/format';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';

type OrgDetail = {
    id: string;
    name: string;
    slug: string | null;
    createdAt: string;
    suspendedAt: string | null;
    subscriptionStatus: string;
    platformInternalNotes?: string | null;
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

type OnboardingStep = {
    id: string;
    label: string;
    description: string;
    done: boolean;
    route: string;
};

type OnboardingStatus = {
    steps: OnboardingStep[];
    completedSteps: number;
    totalSteps: number;
    completionPercent: number;
    pendingTenantSignups: number;
};

type OrgAnalytics = {
    unitCount: number;
    vacantUnitCount: number;
    vacancyRate: number;
    collectionRateLast30Days: number | null;
    overduePaymentCount: number;
    rentRollLast30Days: { totalDue: number; totalPaid: number };
};

const route = useRoute();
const router = useRouter();
const { orgId, orgApi } = usePlatformOrgContext();

const reloadOrgTitle = inject<() => Promise<void>>('reloadOrgTitle');

const loading = ref(true);
const error = ref<string | null>(null);
const org = ref<OrgDetail | null>(null);
const onboarding = ref<OnboardingStatus | null>(null);
const analytics = ref<OrgAnalytics | null>(null);

const editName = ref('');
const editSlug = ref('');
const savingMeta = ref(false);
const metaError = ref<string | null>(null);

const internalNotesDraft = ref('');
const notesSaving = ref(false);
const notesError = ref<string | null>(null);

const suspendBusy = ref(false);
const deleteBusy = ref(false);

function platformStepHref(stepId: string): string {
    const id = orgId.value;
    const map: Record<string, string> = {
        properties: `/organization/${id}/properties`,
        units: `/organization/${id}/properties`,
        people: `/organization/${id}/renters`,
        leases: `/organization/${id}/leases`,
        team: `/organization/${id}/team`,
        stripe: '',
    };
    return map[stepId] ?? '';
}

async function loadOrg() {
    const id = orgId.value;
    if (!id) return;
    loading.value = true;
    error.value = null;
    onboarding.value = null;
    analytics.value = null;
    try {
        const orgPromise = api<OrgDetail>(`/platform/organizations/${id}`);
        const onboardingPromise = platformFeatures.onboardingCard
            ? api<OnboardingStatus>(orgApi('/onboarding-status')).catch(
                  () => null,
              )
            : Promise.resolve(null);
        const analyticsPromise = platformFeatures.analyticsCard
            ? api<OrgAnalytics>(orgApi('/analytics')).catch(() => null)
            : Promise.resolve(null);

        const [orgRes, ob, an] = await Promise.all([
            orgPromise,
            onboardingPromise,
            analyticsPromise,
        ]);

        org.value = orgRes;
        onboarding.value = ob;
        analytics.value = an;
        editName.value = orgRes.name;
        editSlug.value = orgRes.slug ?? '';
        internalNotesDraft.value = orgRes.platformInternalNotes ?? '';
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Failed to load';
        org.value = null;
    } finally {
        loading.value = false;
    }
}

async function saveInternalNotes() {
    if (!org.value) return;
    notesSaving.value = true;
    notesError.value = null;
    try {
        await api(`/platform/organizations/${org.value.id}/internal-notes`, {
            method: 'PATCH',
            body: JSON.stringify({ notes: internalNotesDraft.value }),
        });
        await loadOrg();
        await reloadOrgTitle?.();
    } catch (e) {
        notesError.value = e instanceof Error ? e.message : 'Save failed';
    } finally {
        notesSaving.value = false;
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
        <p v-else-if="error" class="text-sm text-red-600">
            {{ error }}
            <button
                type="button"
                class="ml-2 font-semibold text-indigo-600 underline hover:no-underline"
                @click="loadOrg"
            >
                Retry
            </button>
        </p>

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

            <div
                v-if="platformFeatures.internalNotes"
                class="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
                <h2 class="text-sm font-semibold text-slate-900">
                    Internal notes
                </h2>
                <p class="mt-1 text-xs text-slate-500">
                    Operator-only. Not visible to landlord staff or renters.
                </p>
                <textarea
                    v-model="internalNotesDraft"
                    rows="5"
                    class="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Account context, escalations, billing quirks…"
                />
                <p v-if="notesError" class="mt-2 text-sm text-red-600">
                    {{ notesError }}
                </p>
                <button
                    type="button"
                    class="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    :disabled="notesSaving"
                    @click="saveInternalNotes"
                >
                    {{ notesSaving ? 'Saving…' : 'Save notes' }}
                </button>
            </div>

            <div
                v-if="platformFeatures.onboardingCard && onboarding"
                class="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
                <div class="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 class="text-sm font-semibold text-slate-900">
                            Onboarding checklist
                        </h2>
                        <p class="mt-1 text-xs text-slate-500">
                            {{ onboarding.completedSteps }} /
                            {{ onboarding.totalSteps }} complete ({{
                                onboarding.completionPercent
                            }}%)
                        </p>
                    </div>
                    <RouterLink
                        v-if="onboarding.pendingTenantSignups > 0"
                        class="text-sm font-semibold text-indigo-600 hover:underline"
                        :to="`/organization/${org.id}/signups`"
                    >
                        {{ onboarding.pendingTenantSignups }} pending signup(s)
                    </RouterLink>
                </div>
                <ul class="mt-4 space-y-2">
                    <li
                        v-for="step in onboarding.steps"
                        :key="step.id"
                        class="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                    >
                        <span
                            class="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            :class="
                                step.done
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-slate-200 text-slate-600'
                            "
                        >
                            {{ step.done ? '✓' : '·' }}
                        </span>
                        <div class="min-w-0 flex-1">
                            <p class="font-medium text-slate-900">
                                {{ step.label }}
                            </p>
                            <p class="text-xs text-slate-600">
                                {{ step.description }}
                            </p>
                            <RouterLink
                                v-if="!step.done && platformStepHref(step.id)"
                                class="mt-1 inline-block text-xs font-semibold text-indigo-600 hover:underline"
                                :to="platformStepHref(step.id)"
                            >
                                Open in platform →
                            </RouterLink>
                            <p
                                v-else-if="!step.done && step.id === 'stripe'"
                                class="mt-1 text-xs text-slate-500"
                            >
                                Configure in landlord admin (Settings / billing)
                                or your billing integration.
                            </p>
                        </div>
                    </li>
                </ul>
            </div>

            <div
                v-if="platformFeatures.analyticsCard && analytics"
                class="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
                <h2 class="text-sm font-semibold text-slate-900">
                    Portfolio signals (30d)
                </h2>
                <p class="mt-1 text-xs text-slate-500">
                    Rent collection and occupancy snapshot for this org.
                </p>
                <div
                    class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                >
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p class="text-xs text-slate-500">Vacancy rate</p>
                        <p class="text-lg font-semibold text-slate-900">
                            {{
                                Math.round(analytics.vacancyRate * 1000) / 10
                            }}%
                        </p>
                        <p class="text-xs text-slate-500">
                            {{ analytics.vacantUnitCount }} /
                            {{ analytics.unitCount }} units vacant
                        </p>
                    </div>
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p class="text-xs text-slate-500">Collection (30d)</p>
                        <p class="text-lg font-semibold text-slate-900">
                            {{
                                analytics.collectionRateLast30Days == null
                                    ? '—'
                                    : `${Math.round(analytics.collectionRateLast30Days * 1000) / 10}%`
                            }}
                        </p>
                    </div>
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p class="text-xs text-slate-500">Overdue charges</p>
                        <p class="text-lg font-semibold text-slate-900">
                            {{ analytics.overduePaymentCount }}
                        </p>
                    </div>
                    <div class="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <p class="text-xs text-slate-500">Rent roll 30d (paid)</p>
                        <p class="text-lg font-semibold text-slate-900">
                            {{
                                formatMoney(
                                    analytics.rentRollLast30Days.totalPaid,
                                    'XAF',
                                )
                            }}
                        </p>
                        <p class="text-xs text-slate-500">
                            Due
                            {{
                                formatMoney(
                                    analytics.rentRollLast30Days.totalDue,
                                    'XAF',
                                )
                            }}
                        </p>
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
