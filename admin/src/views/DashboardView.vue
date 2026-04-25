<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import { api, authorizedFetch } from '../lib/api';
import { useOrgStore } from '../stores/org';
import type { OrgSummary } from '../types/models';
import { formatMoney } from '../composables/format';

const orgStore = useOrgStore();
const newOrgName = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const summary = ref<OrgSummary | null>(null);
const summaryLoading = ref(false);

type OnboardingStep = {
    id: string;
    label: string;
    description: string;
    done: boolean;
    route: string;
};

const onboarding = ref<{
    steps: OnboardingStep[];
    completionPercent: number;
    pendingTenantSignups: number;
} | null>(null);
const onboardingLoading = ref(false);
const exportBusy = ref(false);
const exportErr = ref<string | null>(null);

type OrgAnalytics = {
    vacancyRate: number;
    collectionRateLast30Days: number | null;
    overduePaymentCount: number;
    rentRollLast30Days: {
        totalDue: number;
        totalPaid: number;
        byCurrency: Record<string, { due: number; paid: number }>;
    };
    arrearsAgingDays: Record<
        string,
        { paymentCount: number; totalAmount: number }
    >;
};

const analytics = ref<OrgAnalytics | null>(null);
const analyticsLoading = ref(false);

const selectedId = computed(() => orgStore.selectedOrgId);

const currentOrg = computed(
    () => orgStore.organizations.find((o) => o.id === selectedId.value) ?? null,
);

const canExportRentRoll = computed(() => {
    const role = orgStore.selectedOrgMyRole;
    return role === 'OWNER' || role === 'MANAGER';
});

const copyMsg = ref<string | null>(null);

async function copyText(label: string, text: string) {
    copyMsg.value = null;
    try {
        await navigator.clipboard.writeText(text);
        copyMsg.value = `${label} copied`;
        window.setTimeout(() => {
            copyMsg.value = null;
        }, 2000);
    } catch {
        copyMsg.value = 'Could not copy';
    }
}

async function loadSummary() {
    const id = orgStore.selectedOrgId;
    if (!id) {
        summary.value = null;
        return;
    }
    summaryLoading.value = true;
    try {
        summary.value = await api<OrgSummary>(`/organizations/${id}/summary`);
    } catch {
        summary.value = null;
    } finally {
        summaryLoading.value = false;
    }
}

async function loadAnalytics() {
    const id = orgStore.selectedOrgId;
    if (!id) {
        analytics.value = null;
        return;
    }
    analyticsLoading.value = true;
    try {
        analytics.value = await api<OrgAnalytics>(
            `/organizations/${id}/analytics`,
        );
    } catch {
        analytics.value = null;
    } finally {
        analyticsLoading.value = false;
    }
}

async function loadOnboarding() {
    const id = orgStore.selectedOrgId;
    if (!id) {
        onboarding.value = null;
        return;
    }
    onboardingLoading.value = true;
    try {
        onboarding.value = await api<{
            steps: OnboardingStep[];
            completionPercent: number;
            pendingTenantSignups: number;
        }>(`/organizations/${id}/onboarding-status`);
    } catch {
        onboarding.value = null;
    } finally {
        onboardingLoading.value = false;
    }
}

async function downloadRentRoll() {
    const id = orgStore.selectedOrgId;
    if (!id || !canExportRentRoll.value) return;
    exportBusy.value = true;
    exportErr.value = null;
    try {
        const path = `/organizations/${id}/exports/rent-roll`;
        const res = await authorizedFetch(path);
        if (!res.ok) {
            const text = await res.text();
            let message = res.statusText;
            try {
                const j = JSON.parse(text) as { message?: string | string[] };
                if (typeof j.message === 'string') message = j.message;
                else if (Array.isArray(j.message))
                    message = j.message.join(', ');
            } catch {
                if (text) message = text;
            }
            throw new Error(message);
        }
        const blob = await res.blob();
        const a = document.createElement('a');
        const href = URL.createObjectURL(blob);
        a.href = href;
        a.download = `rent-roll-${id.slice(0, 8)}.csv`;
        a.click();
        URL.revokeObjectURL(href);
    } catch (e) {
        exportErr.value =
            e instanceof Error ? e.message : 'Could not download export';
    } finally {
        exportBusy.value = false;
    }
}

async function createOrg() {
    const name = newOrgName.value.trim();
    if (!name) return;
    submitting.value = true;
    error.value = null;
    try {
        const created = await api<{ id: string }>('/organizations', {
            method: 'POST',
            body: JSON.stringify({ name }),
        });
        newOrgName.value = '';
        await orgStore.fetchOrganizations();
        orgStore.setOrg(created.id);
        await loadSummary();
    } catch (e) {
        error.value =
            e instanceof Error ? e.message : 'Could not create organization';
    } finally {
        submitting.value = false;
    }
}

onMounted(() => {
    void loadSummary();
    void loadOnboarding();
    void loadAnalytics();
});

watch(
    () => orgStore.selectedOrgId,
    () => {
        void loadSummary();
        void loadOnboarding();
        void loadAnalytics();
    },
);

const rentRollPct = computed(() => {
    if (!analytics.value) return 0;
    const { totalDue, totalPaid } = analytics.value.rentRollLast30Days;
    if (!totalDue) return 0;
    return Math.min(Math.round((totalPaid / totalDue) * 100), 100);
});

const arrearsMax = computed(() => {
    if (!analytics.value) return 1;
    const buckets = ['0_30', '31_60', '61_90', '91_plus'];
    return (
        Math.max(
            ...buckets.map(
                (k) => analytics.value!.arrearsAgingDays[k]?.paymentCount ?? 0,
            ),
        ) || 1
    );
});

const collectionColor = computed(() => {
    const r = analytics.value?.collectionRateLast30Days;
    if (r == null) return 'text-slate-400';
    if (r >= 0.8) return 'text-emerald-400';
    if (r >= 0.5) return 'text-amber-300';
    return 'text-red-400';
});

const vacancyColor = computed(() => {
    const v = analytics.value?.vacancyRate ?? 0;
    if (v <= 0.15) return 'text-emerald-400';
    if (v <= 0.3) return 'text-amber-300';
    return 'text-red-400';
});

const statCards = computed(() => {
    if (!summary.value) return [];
    const s = summary.value;
    return [
        {
            label: 'Properties',
            value: s.propertyCount,
            hint: 'Buildings & sites',
            tone: 'from-violet-500 to-purple-600',
        },
        {
            label: 'Units',
            value: s.unitCount,
            hint: `${s.occupiedUnitCount} occupied · ${s.vacantUnitCount} vacant`,
            tone: 'from-emerald-500 to-teal-600',
        },
        {
            label: 'Renters',
            value: s.renterCount,
            hint: 'Active profiles',
            tone: 'from-sky-500 to-blue-600',
        },
        {
            label: 'Leases',
            value: s.leaseCount,
            hint: 'Recorded agreements',
            tone: 'from-amber-500 to-orange-600',
        },
    ];
});
</script>

<template>
    <div class="space-y-8">
        <div
            :class="
                currentOrg ? 'grid gap-6 md:grid-cols-2 md:items-stretch' : ''
            "
        >
            <section
                class="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
            >
                <div
                    class="border-b border-slate-100 bg-linear-to-r from-slate-50 to-white px-6 py-5 sm:px-8"
                >
                    <h2 class="text-base font-semibold text-slate-900">
                        Create organization
                    </h2>
                    <p class="mt-1 text-sm text-slate-600">
                        Each organization is an isolated portfolio (your SaaS
                        tenant). Add one for each landlord or agency you manage.
                    </p>
                </div>
                <form
                    class="flex flex-1 flex-col gap-4 p-6 sm:flex-row sm:items-end sm:px-8 sm:pb-8"
                    @submit.prevent="createOrg"
                >
                    <label class="min-w-0 flex-1">
                        <span
                            class="mb-1.5 block text-sm font-medium text-slate-700"
                            >Organization name</span
                        >
                        <input
                            v-model="newOrgName"
                            type="text"
                            class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-slate-900 shadow-inner transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            placeholder="e.g. Douala Rentals"
                            autocomplete="organization"
                        />
                    </label>
                    <button
                        type="submit"
                        class="inline-flex shrink-0 items-center justify-center rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/10 transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"
                        :disabled="submitting || !newOrgName.trim()"
                    >
                        {{ submitting ? 'Creating…' : 'Create' }}
                    </button>
                </form>
                <p
                    v-if="error"
                    class="mt-auto px-6 pb-4 text-sm text-red-600 sm:px-8"
                >
                    {{ error }}
                </p>
            </section>

            <section
                v-if="currentOrg"
                class="flex h-full min-h-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
                <p
                    class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                    Tenant self-signup
                </p>
                <p class="mt-1 text-sm text-slate-600">
                    Share the <strong>sign-up code</strong> (letters and
                    numbers) with renters so they can request access in the
                    tenant app. The internal ID still works for advanced cases.
                </p>
                <dl class="mt-3 flex-1 space-y-2 text-sm">
                    <div
                        v-if="currentOrg.tenantSignUpCode"
                        class="flex flex-wrap items-center gap-2"
                    >
                        <dt class="text-slate-500">Sign-up code</dt>
                        <dd
                            class="font-mono text-sm font-semibold tracking-wide text-slate-900"
                        >
                            {{ currentOrg.tenantSignUpCode }}
                        </dd>
                        <button
                            type="button"
                            class="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            @click="
                                copyText(
                                    'Sign-up code',
                                    currentOrg.tenantSignUpCode!,
                                )
                            "
                        >
                            Copy
                        </button>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <dt class="text-slate-500">Organization ID</dt>
                        <dd class="font-mono text-xs text-slate-800">
                            {{ currentOrg.id }}
                        </dd>
                        <button
                            type="button"
                            class="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            @click="copyText('Organization ID', currentOrg.id)"
                        >
                            Copy
                        </button>
                    </div>
                </dl>
                <p v-if="copyMsg" class="mt-2 text-xs text-emerald-700">
                    {{ copyMsg }}
                </p>
            </section>
        </div>

        <section
            v-if="!selectedId"
            class="rounded-2xl border border-amber-200/80 bg-amber-50/50 px-6 py-8 text-center sm:px-8"
        >
            <p class="text-sm font-medium text-amber-900">
                Select an organization above
            </p>
            <p class="mt-1 text-sm text-amber-800/90">
                Overview metrics appear after you pick a portfolio from the
                header menu.
            </p>
        </section>

        <section v-else>
            <div
                v-if="onboarding && onboarding.completionPercent < 100"
                class="mb-6 rounded-2xl border border-indigo-200/80 bg-linear-to-br from-indigo-50/90 to-white p-5 shadow-sm"
            >
                <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 class="text-sm font-semibold text-indigo-950">
                            Getting started
                        </h2>
                        <p class="mt-1 text-xs text-indigo-900/80">
                            {{ onboarding.completionPercent }}% complete ·
                            finish these steps to run a clean demo or go live.
                        </p>
                        <p
                            v-if="onboarding.pendingTenantSignups > 0"
                            class="mt-2 text-xs font-medium text-amber-800"
                        >
                            {{ onboarding.pendingTenantSignups }} tenant
                            signup(s) waiting — visit Renters to approve.
                        </p>
                    </div>
                    <span
                        v-if="onboardingLoading"
                        class="text-xs text-indigo-400"
                        >Loading…</span
                    >
                </div>
                <ul class="mt-4 space-y-2">
                    <li
                        v-for="step in onboarding.steps"
                        :key="step.id"
                        class="flex gap-3 rounded-xl border border-indigo-100/80 bg-white/80 px-3 py-2.5 text-sm"
                    >
                        <span
                            class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            :class="
                                step.done
                                    ? 'bg-emerald-500 text-white'
                                    : 'border border-slate-200 bg-slate-50 text-slate-500'
                            "
                            >{{ step.done ? '✓' : '' }}</span
                        >
                        <div class="min-w-0 flex-1">
                            <p class="font-medium text-slate-900">
                                {{ step.label }}
                            </p>
                            <p class="text-xs text-slate-600">
                                {{ step.description }}
                            </p>
                            <RouterLink
                                v-if="!step.done"
                                :to="step.route"
                                class="mt-1 inline-block text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                            >
                                Open
                            </RouterLink>
                        </div>
                    </li>
                </ul>
            </div>

            <div
                v-if="selectedId && canExportRentRoll"
                class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
                <div>
                    <h2 class="text-sm font-semibold text-slate-900">
                        Exports
                    </h2>
                    <p class="text-xs text-slate-500">
                        Download a UTF-8 rent roll for spreadsheets or audits.
                    </p>
                    <p
                        v-if="exportErr"
                        class="mt-2 text-xs font-medium text-red-600"
                    >
                        {{ exportErr }}
                    </p>
                </div>
                <button
                    type="button"
                    class="inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="exportBusy"
                    @click="downloadRentRoll"
                >
                    {{ exportBusy ? 'Preparing…' : 'Rent roll (CSV)' }}
                </button>
            </div>

            <div class="mb-4 flex items-end justify-between gap-4">
                <div>
                    <h2
                        class="text-sm font-semibold uppercase tracking-wide text-slate-500"
                    >
                        Portfolio snapshot
                    </h2>
                    <p class="text-xs text-slate-500">
                        Live counts for the selected organization
                    </p>
                </div>
                <span v-if="summaryLoading" class="text-xs text-slate-400"
                    >Updating…</span
                >
            </div>

            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article
                    v-for="card in statCards"
                    :key="card.label"
                    class="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                    <div
                        :class="[
                            'absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.12] blur-2xl transition group-hover:opacity-20 bg-linear-to-br',
                            card.tone,
                        ]"
                    />
                    <p
                        class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                        {{ card.label }}
                    </p>
                    <p
                        class="mt-2 text-3xl font-bold tabular-nums tracking-tight text-slate-900"
                    >
                        {{ card.value }}
                    </p>
                    <p class="mt-1 text-xs text-slate-500">{{ card.hint }}</p>
                </article>
            </div>

            <div
                v-if="summary && summary.unitCount > 0"
                class="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
                <h3 class="text-sm font-semibold text-slate-900">Occupancy</h3>
                <div class="mt-4 flex items-center gap-3">
                    <div
                        class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"
                    >
                        <div
                            class="h-full rounded-full bg-linear-to-r from-emerald-500 to-teal-500 transition-all"
                            :style="{
                                width: `${summary.unitCount ? Math.round((summary.occupiedUnitCount / summary.unitCount) * 100) : 0}%`,
                            }"
                        />
                    </div>
                    <span
                        class="text-sm font-medium tabular-nums text-slate-700"
                    >
                        {{
                            summary.unitCount
                                ? Math.round(
                                      (summary.occupiedUnitCount /
                                          summary.unitCount) *
                                          100,
                                  )
                                : 0
                        }}%
                    </span>
                </div>
                <p class="mt-2 text-xs text-slate-500">
                    Portfolio load — {{ summary.occupiedUnitCount }} of
                    {{ summary.unitCount }} units occupied.
                </p>
            </div>
        </section>

        <section
            v-if="selectedId"
            class="rounded-2xl border border-slate-200 bg-slate-900 px-6 py-8 text-slate-300 sm:px-8"
        >
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-semibold text-white">
                    Portfolio analytics
                </h3>
                <span v-if="analyticsLoading" class="text-xs text-slate-500"
                    >Updating…</span
                >
            </div>
            <template v-if="analytics">
                <!-- KPI cards -->
                <div
                    class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm"
                >
                    <!-- Vacancy rate -->
                    <div class="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                        <p
                            class="text-xs uppercase tracking-wide text-slate-500"
                        >
                            Vacancy rate
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold tabular-nums"
                            :class="vacancyColor"
                        >
                            {{ Math.round(analytics.vacancyRate * 100) }}%
                        </p>
                        <div
                            class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                        >
                            <div
                                class="h-full rounded-full transition-all"
                                :class="
                                    analytics.vacancyRate <= 0.15
                                        ? 'bg-emerald-500'
                                        : analytics.vacancyRate <= 0.3
                                          ? 'bg-amber-400'
                                          : 'bg-red-500'
                                "
                                :style="{
                                    width: `${Math.round(analytics.vacancyRate * 100)}%`,
                                }"
                            />
                        </div>
                        <p class="mt-1 text-xs text-slate-600">
                            {{
                                analytics.vacancyRate <= 0.15
                                    ? 'Healthy occupancy'
                                    : analytics.vacancyRate <= 0.3
                                      ? 'Moderate vacancy'
                                      : 'High vacancy'
                            }}
                        </p>
                    </div>
                    <!-- Collection rate -->
                    <div class="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                        <p
                            class="text-xs uppercase tracking-wide text-slate-500"
                        >
                            Collection (30d)
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold tabular-nums"
                            :class="collectionColor"
                        >
                            {{
                                analytics.collectionRateLast30Days == null
                                    ? '—'
                                    : `${Math.round(analytics.collectionRateLast30Days * 100)}%`
                            }}
                        </p>
                        <div
                            v-if="analytics.collectionRateLast30Days != null"
                            class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                        >
                            <div
                                class="h-full rounded-full transition-all"
                                :class="
                                    analytics.collectionRateLast30Days >= 0.8
                                        ? 'bg-emerald-500'
                                        : analytics.collectionRateLast30Days >=
                                            0.5
                                          ? 'bg-amber-400'
                                          : 'bg-red-500'
                                "
                                :style="{
                                    width: `${Math.round(analytics.collectionRateLast30Days * 100)}%`,
                                }"
                            />
                        </div>
                        <p class="mt-1 text-xs text-slate-600">
                            {{
                                analytics.collectionRateLast30Days == null
                                    ? 'No charges yet'
                                    : analytics.collectionRateLast30Days >= 0.8
                                      ? 'On track'
                                      : analytics.collectionRateLast30Days >=
                                          0.5
                                        ? 'Needs attention'
                                        : 'Critical'
                            }}
                        </p>
                    </div>
                    <!-- Overdue charges -->
                    <div class="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                        <p
                            class="text-xs uppercase tracking-wide text-slate-500"
                        >
                            Overdue charges
                        </p>
                        <p
                            class="mt-1 text-2xl font-bold tabular-nums"
                            :class="
                                analytics.overduePaymentCount === 0
                                    ? 'text-emerald-400'
                                    : analytics.overduePaymentCount < 5
                                      ? 'text-amber-300'
                                      : 'text-red-400'
                            "
                        >
                            {{ analytics.overduePaymentCount }}
                        </p>
                        <p class="mt-1 text-xs text-slate-600">
                            {{
                                analytics.overduePaymentCount === 0
                                    ? 'All current'
                                    : analytics.overduePaymentCount === 1
                                      ? '1 payment past due'
                                      : `${analytics.overduePaymentCount} payments past due`
                            }}
                        </p>
                    </div>
                    <!-- Rent roll -->
                    <div class="rounded-xl bg-white/5 p-4 ring-1 ring-white/10">
                        <p
                            class="text-xs uppercase tracking-wide text-slate-500"
                        >
                            Rent roll (30d)
                        </p>
                        <p
                            class="mt-1 text-base font-semibold text-white tabular-nums leading-snug"
                        >
                            {{
                                formatMoney(
                                    analytics.rentRollLast30Days.totalPaid,
                                    'XAF',
                                )
                            }}
                            <span class="text-slate-500 text-sm font-normal">
                                /
                                {{
                                    formatMoney(
                                        analytics.rentRollLast30Days.totalDue,
                                        'XAF',
                                    )
                                }}</span
                            >
                        </p>
                        <div
                            class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
                        >
                            <div
                                class="h-full rounded-full bg-emerald-500 transition-all"
                                :style="{ width: `${rentRollPct}%` }"
                            />
                        </div>
                        <p class="mt-1 text-xs text-slate-600">
                            {{ rentRollPct }}% collected
                        </p>
                    </div>
                </div>

                <!-- Arrears aging bar chart -->
                <div class="mt-6">
                    <p
                        class="text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                        Arrears aging — open charges by overdue period
                    </p>
                    <div class="mt-3 space-y-2">
                        <div
                            v-for="b in [
                                {
                                    k: '0_30',
                                    label: '0–30 days',
                                    color: 'bg-amber-400',
                                },
                                {
                                    k: '31_60',
                                    label: '31–60 days',
                                    color: 'bg-orange-500',
                                },
                                {
                                    k: '61_90',
                                    label: '61–90 days',
                                    color: 'bg-red-500',
                                },
                                {
                                    k: '91_plus',
                                    label: '91+ days',
                                    color: 'bg-red-700',
                                },
                            ]"
                            :key="b.k"
                            class="flex items-center gap-3 text-sm"
                        >
                            <span
                                class="w-22 shrink-0 text-xs text-slate-500"
                                >{{ b.label }}</span
                            >
                            <div
                                class="h-5 flex-1 overflow-hidden rounded bg-white/5"
                            >
                                <div
                                    class="flex h-full items-center rounded transition-all"
                                    :class="b.color"
                                    :style="{
                                        width: `${arrearsMax > 0 ? Math.round(((analytics.arrearsAgingDays[b.k]?.paymentCount ?? 0) / arrearsMax) * 100) : 0}%`,
                                        minWidth: analytics.arrearsAgingDays[
                                            b.k
                                        ]?.paymentCount
                                            ? '2px'
                                            : '0',
                                    }"
                                />
                            </div>
                            <span
                                class="w-32 shrink-0 text-right text-xs text-slate-400 tabular-nums"
                            >
                                {{
                                    analytics.arrearsAgingDays[b.k]
                                        ?.paymentCount ?? 0
                                }}
                                ·
                                {{
                                    formatMoney(
                                        analytics.arrearsAgingDays[b.k]
                                            ?.totalAmount ?? 0,
                                        'XAF',
                                    )
                                }}
                            </span>
                        </div>
                    </div>
                </div>
            </template>
            <p v-else class="mt-2 text-sm text-slate-500">
                Analytics load when an organization is selected.
            </p>
        </section>
    </div>
</template>
