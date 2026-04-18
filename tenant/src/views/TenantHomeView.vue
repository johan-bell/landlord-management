<script setup lang="ts">
import { BoltIcon, BeakerIcon } from '@heroicons/vue/24/outline';
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../lib/api';
import {
    prepareReceiptUpload,
    putToPresignedUrl,
} from '../lib/receipt-upload';
import { useAuthStore } from '../stores/auth';
import TenantMark from '../components/TenantMark.vue';
import TenantHeaderMenu from '../components/TenantHeaderMenu.vue';
import TenantModal from '../components/TenantModal.vue';

type MeActive = {
    status: 'active';
    renter: {
        id: string;
        fullName: string;
        phone: string | null;
        email: string | null;
    };
    organization: { id: string; name: string };
};

type MePending = {
    status: 'pending';
    fullName: string | null;
    email: string | null;
    phone: string | null;
    organization: { id: string; name: string };
    message: string;
};

type MeRejected = {
    status: 'rejected';
    organization: { id: string; name: string };
    message: string;
};

type MeResponse = MeActive | MePending | MeRejected;

type SupportTicket = {
    id: string;
    subject: string;
    message: string;
    status: string;
    createdAt: string;
    closedAt: string | null;
    resolutionNote: string | null;
    organization: { id: string; name: string } | null;
};

type LeaseRow = {
    id: string;
    startDate: string;
    endDate: string | null;
    rentAmount: string;
    currency: string;
    dueDay: number;
    unit: {
        label: string;
        currency: string;
        electricityBilling: 'PREPAID_EXTERNAL' | 'METERED_KWH';
        electricityPricePerKwh: string | null;
        waterBilling: 'NONE' | 'METERED_M3';
        waterPricePerM3: string | null;
        property: { name: string; address: string | null };
    };
    payments: {
        id: string;
        dueDate: string;
        amount: string;
        status: string;
        paidAt: string | null;
        proofVerification?: string;
        proofSubmittedAt?: string | null;
        proofRejectionNote?: string | null;
    }[];
    utilityBills?: {
        id: string;
        kind: 'ELECTRICITY' | 'WATER';
        year: number;
        month: number;
        amount: string;
        currency: string;
        dueDate: string;
        status: string;
        paidAt: string | null;
        previousIndex?: string | null;
        currentIndex?: string | null;
        consumption?: string | null;
        proofVerification?: string;
        proofSubmittedAt?: string | null;
        proofRejectionNote?: string | null;
    }[];
};

const router = useRouter();
const auth = useAuthStore();

const loading = ref(true);
const error = ref<string | null>(null);
const me = ref<MeResponse | null>(null);
const leases = ref<LeaseRow[]>([]);

const pwdCurrent = ref('');
const pwdNew = ref('');
const pwdMsg = ref<string | null>(null);
const pwdErr = ref<string | null>(null);
const pwdSaving = ref(false);

const supportTickets = ref<SupportTicket[]>([]);
const supportSubject = ref('');
const supportMessage = ref('');
const supportBusy = ref(false);
const supportErr = ref<string | null>(null);
const supportOk = ref(false);

const passwordModalOpen = ref(false);
const supportModalOpen = ref(false);

const uploadBusyKey = ref<string | null>(null);
const uploadErr = ref<string | null>(null);

let pollTimer: ReturnType<typeof setInterval> | null = null;

function initials(name: string | null | undefined) {
    if (!name?.trim()) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function money(amount: string, currency: string) {
    const n = Number(amount);
    if (Number.isNaN(n)) return `${amount} ${currency}`;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
        }).format(n);
    } catch {
        return `${amount} ${currency}`;
    }
}

function moneyPerKwh(amount: string, currency: string) {
    const n = Number(amount);
    if (Number.isNaN(n)) return '—';
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 4,
        }).format(n);
    } catch {
        return `${amount} ${currency}`;
    }
}

function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    } catch {
        return iso;
    }
}

function utilityPeriodLabel(year: number, month: number) {
    return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
    });
}

function rentProofLabel(p: LeaseRow['payments'][0]) {
    if (p.status === 'PAID') return 'Paid';
    const v = p.proofVerification ?? 'NONE';
    if (v === 'PENDING_VERIFICATION') return 'Receipt sent — waiting for landlord';
    if (v === 'REJECTED') return 'Receipt rejected — upload again';
    return 'Unpaid';
}

function utilityProofLabel(ub: NonNullable<LeaseRow['utilityBills']>[0]) {
    if (ub.status === 'PAID') return 'Paid';
    const v = ub.proofVerification ?? 'NONE';
    if (v === 'PENDING_VERIFICATION') return 'Receipt sent — waiting for landlord';
    if (v === 'REJECTED') return 'Receipt rejected — upload again';
    return 'Unpaid';
}

function canUploadProof(
    status: string,
    proofVerification: string | undefined,
) {
    if (status === 'PAID') return false;
    const v = proofVerification ?? 'NONE';
    return v === 'NONE' || v === 'REJECTED';
}

type HistoryTab = 'lease' | 'electricity' | 'water';

function leaseHasMeteredElectricity(lease: LeaseRow) {
    return lease.unit.electricityBilling === 'METERED_KWH';
}

function leaseHasMeteredWater(lease: LeaseRow) {
    return lease.unit.waterBilling === 'METERED_M3';
}

function historyTabsForLease(lease: LeaseRow): HistoryTab[] {
    const tabs: HistoryTab[] = ['lease'];
    if (leaseHasMeteredElectricity(lease)) tabs.push('electricity');
    if (leaseHasMeteredWater(lease)) tabs.push('water');
    return tabs;
}

function showPaymentHistorySection(lease: LeaseRow) {
    return (
        lease.payments.length > 0 ||
        leaseHasMeteredElectricity(lease) ||
        leaseHasMeteredWater(lease)
    );
}

function historyTabLabel(tab: HistoryTab): string {
    if (tab === 'lease') return 'Lease';
    if (tab === 'electricity') return 'Electricity';
    return 'Water';
}

const paymentHistoryTabByLeaseId = reactive<Record<string, HistoryTab>>({});

function currentHistoryTab(lease: LeaseRow): HistoryTab {
    const allowed = historyTabsForLease(lease);
    const stored = paymentHistoryTabByLeaseId[lease.id];
    if (stored && allowed.includes(stored)) return stored;
    return allowed[0] ?? 'lease';
}

function setHistoryTab(leaseId: string, tab: HistoryTab) {
    paymentHistoryTabByLeaseId[leaseId] = tab;
}

type NextDueItem =
    | {
          kind: 'rent';
          dueDate: string;
          amount: string;
          currency: string;
          leaseId: string;
          paymentId: string;
          placeLabel: string;
      }
    | {
          kind: 'utility';
          dueDate: string;
          amount: string;
          currency: string;
          leaseId: string;
          billId: string;
          utilityLabel: string;
          placeLabel: string;
      };

const whatsDueNext = computed(() => {
    const items: NextDueItem[] = [];
    for (const lease of leases.value) {
        const placeLabel = `${lease.unit.property.name} · ${lease.unit.label}`;
        for (const p of lease.payments) {
            if (p.status === 'PAID' || p.status === 'CANCELLED') continue;
            const v = p.proofVerification ?? 'NONE';
            if (v === 'PENDING_VERIFICATION') continue;
            items.push({
                kind: 'rent',
                dueDate: p.dueDate,
                amount: p.amount,
                currency: lease.currency,
                leaseId: lease.id,
                paymentId: p.id,
                placeLabel,
            });
        }
        for (const ub of lease.utilityBills ?? []) {
            if (ub.status === 'PAID' || ub.status === 'CANCELLED') continue;
            const v = ub.proofVerification ?? 'NONE';
            if (v === 'PENDING_VERIFICATION') continue;
            const utilityLabel =
                ub.kind === 'ELECTRICITY' ? 'Electricity' : 'Water';
            items.push({
                kind: 'utility',
                dueDate: ub.dueDate,
                amount: ub.amount,
                currency: ub.currency,
                leaseId: lease.id,
                billId: ub.id,
                utilityLabel,
                placeLabel,
            });
        }
    }
    items.sort(
        (a, b) =>
            new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
    return {
        next: items[0] ?? null,
        upcomingCount: items.length,
        timeline: items.slice(0, 8),
    };
});

const pendingProofCount = computed(() => {
    let n = 0;
    for (const lease of leases.value) {
        for (const p of lease.payments) {
            if ((p.proofVerification ?? 'NONE') === 'PENDING_VERIFICATION') {
                n++;
            }
        }
        for (const ub of lease.utilityBills ?? []) {
            if ((ub.proofVerification ?? 'NONE') === 'PENDING_VERIFICATION') {
                n++;
            }
        }
    }
    return n;
});

function nextDueTitle(item: NextDueItem) {
    if (item.kind === 'rent') return 'Rent';
    return item.utilityLabel;
}

function rentPaymentsNewestFirst(lease: LeaseRow) {
    return [...lease.payments].sort(
        (a, b) =>
            new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime(),
    );
}

function utilityBillsByKind(
    lease: LeaseRow,
    kind: 'ELECTRICITY' | 'WATER',
) {
    return (lease.utilityBills ?? [])
        .filter((b) => b.kind === kind)
        .sort(
            (a, b) =>
                b.year - a.year || b.month - a.month || b.id.localeCompare(a.id),
        );
}

async function submitProofFile(
    file: File,
    orgId: string,
    leaseId: string,
    target: 'RENT' | 'UTILITY',
    paymentId?: string,
    utilityBillId?: string,
) {
    const prepared = await prepareReceiptUpload(file);
    const contentType = prepared.type || file.type || 'image/jpeg';
    const intent = await api<{
        uploadUrl: string;
        objectKey: string;
    }>('/tenant/proofs/upload-intent', {
        method: 'POST',
        body: JSON.stringify({ organizationId: orgId, contentType }),
    });
    await putToPresignedUrl(intent.uploadUrl, prepared, contentType);
    await api('/tenant/proofs/attach', {
        method: 'POST',
        body: JSON.stringify({
            target,
            organizationId: orgId,
            leaseId,
            objectKey: intent.objectKey,
            contentType,
            ...(target === 'RENT' ? { paymentId } : { utilityBillId }),
        }),
    });
}

async function onRentProofPick(
    ev: Event,
    orgId: string,
    leaseId: string,
    paymentId: string,
) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    uploadErr.value = null;
    const key = `rent:${paymentId}`;
    uploadBusyKey.value = key;
    try {
        await submitProofFile(file, orgId, leaseId, 'RENT', paymentId);
        await refreshMe();
    } catch (e) {
        uploadErr.value =
            e instanceof Error ? e.message : 'Upload failed — try again';
    } finally {
        uploadBusyKey.value = null;
    }
}

async function onUtilityProofPick(
    ev: Event,
    orgId: string,
    leaseId: string,
    billId: string,
) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    uploadErr.value = null;
    const key = `util:${billId}`;
    uploadBusyKey.value = key;
    try {
        await submitProofFile(file, orgId, leaseId, 'UTILITY', undefined, billId);
        await refreshMe();
    } catch (e) {
        uploadErr.value =
            e instanceof Error ? e.message : 'Upload failed — try again';
    } finally {
        uploadBusyKey.value = null;
    }
}

function logout() {
    auth.clearSession();
    void router.push('/login');
}

const headerInitials = computed(() => {
    if (!me.value && error.value) return '?';
    const m = me.value;
    if (!m) return '?';
    if (m.status === 'active') return initials(m.renter.fullName);
    if (m.status === 'pending') return initials(m.fullName);
    return initials(m.organization.name);
});

const headerShowPassword = computed(() => {
    const m = me.value;
    return Boolean(m && (m.status === 'pending' || m.status === 'active'));
});

const headerShowSupport = computed(() => headerShowPassword.value);

const headerMenuLabel = computed(() => {
    const m = me.value;
    if (!m && error.value) return 'Account menu';
    if (!m) return 'Account menu';
    if (m.status === 'active') return `Account menu for ${m.renter.fullName}`;
    if (m.status === 'pending')
        return `Account menu for ${m.fullName || 'your account'}`;
    return `Account menu for ${m.organization.name}`;
});

function openPasswordModal() {
    pwdMsg.value = null;
    pwdErr.value = null;
    passwordModalOpen.value = true;
}

function openSupportModal() {
    supportErr.value = null;
    supportModalOpen.value = true;
}

async function changePassword() {
    pwdMsg.value = null;
    pwdErr.value = null;
    pwdSaving.value = true;
    try {
        await api('/tenant/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                currentPassword: pwdCurrent.value,
                newPassword: pwdNew.value,
            }),
        });
        pwdCurrent.value = '';
        pwdNew.value = '';
        pwdMsg.value = 'Password updated.';
    } catch (e) {
        pwdErr.value =
            e instanceof Error ? e.message : 'Could not update password';
    } finally {
        pwdSaving.value = false;
    }
}

async function loadSupport() {
    try {
        supportTickets.value = await api<SupportTicket[]>(
            '/tenant/support-requests',
        );
    } catch {
        supportTickets.value = [];
    }
}

function onSubmitSupport() {
    const m = me.value;
    if (!m || (m.status !== 'active' && m.status !== 'pending')) return;
    void submitSupport(m.organization.id);
}

async function submitSupport(orgId: string) {
    supportErr.value = null;
    supportOk.value = false;
    supportBusy.value = true;
    try {
        await api('/tenant/support-requests', {
            method: 'POST',
            body: JSON.stringify({
                subject: supportSubject.value.trim(),
                message: supportMessage.value.trim(),
                organizationId: orgId,
            }),
        });
        supportSubject.value = '';
        supportMessage.value = '';
        supportOk.value = true;
        window.setTimeout(() => {
            supportOk.value = false;
        }, 5000);
        await loadSupport();
        supportModalOpen.value = false;
    } catch (e) {
        supportErr.value =
            e instanceof Error ? e.message : 'Could not send request';
    } finally {
        supportBusy.value = false;
    }
}

async function refreshMe() {
    const m = await api<MeResponse>('/tenant/me');
    me.value = m;
    if (m.status === 'active') {
        leases.value = await api<LeaseRow[]>('/tenant/leases');
        if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
        }
    } else {
        leases.value = [];
    }
    if (m.status === 'active' || m.status === 'pending') {
        await loadSupport();
    } else {
        supportTickets.value = [];
    }
}

onMounted(async () => {
    loading.value = true;
    error.value = null;
    try {
        await refreshMe();
        if (me.value?.status === 'pending') {
            pollTimer = setInterval(() => {
                void refreshMe().catch(() => undefined);
            }, 25000);
        }
    } catch (e) {
        error.value =
            e instanceof Error ? e.message : 'Could not load your account';
    } finally {
        loading.value = false;
    }
});

onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
    <div class="min-h-screen pb-24 pt-0 sm:pb-16">
        <header
            class="sticky top-0 z-20 border-b border-slate-200/60 bg-white/75 px-4 py-4 backdrop-blur-md sm:px-6"
        >
            <div
                class="mx-auto flex max-w-2xl items-center justify-between gap-3 lg:max-w-3xl"
            >
                <TenantMark v-if="me" variant="inline">
                    <template #subtitle>{{ me.organization.name }}</template>
                </TenantMark>
                <div v-else class="flex items-center gap-3 opacity-70">
                    <div
                        class="h-10 w-10 animate-pulse rounded-2xl bg-slate-200"
                    />
                    <div class="h-4 w-28 animate-pulse rounded bg-slate-200" />
                </div>
                <TenantHeaderMenu
                    v-if="!loading && (me || error)"
                    :initials="headerInitials"
                    :menu-label="headerMenuLabel"
                    :show-password="headerShowPassword"
                    :show-support="headerShowSupport"
                    @sign-out="logout"
                    @go-password="openPasswordModal"
                    @go-support="openSupportModal"
                />
                <div
                    v-else
                    class="h-10 w-[4.75rem] shrink-0 animate-pulse rounded-2xl bg-slate-200/90"
                    aria-hidden="true"
                />
            </div>
        </header>

        <main class="mx-auto max-w-2xl px-4 pt-8 sm:px-6 lg:max-w-3xl">
            <div v-if="loading" class="tenant-card space-y-4 p-8">
                <div class="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
                <div class="h-24 animate-pulse rounded-2xl bg-slate-100/90" />
                <div class="h-32 animate-pulse rounded-2xl bg-slate-100/80" />
            </div>
            <div
                v-else-if="error"
                class="tenant-card border-red-200/80 bg-red-50/50 p-6"
                role="alert"
            >
                <p class="font-semibold text-red-900">Something went wrong</p>
                <p class="mt-2 text-sm text-red-800">{{ error }}</p>
                <p class="mt-3 text-xs text-red-700/90">
                    If this keeps happening, confirm the API is running and your
                    account still has access.
                </p>
            </div>

            <template v-else-if="me?.status === 'pending'">
                <div
                    class="tenant-card border-amber-200/90 bg-gradient-to-br from-amber-50/95 to-orange-50/40 p-6"
                    role="status"
                >
                    <div class="flex gap-3">
                        <div
                            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-lg font-bold text-amber-900 ring-1 ring-amber-200/80"
                            aria-hidden="true"
                        >
                            P
                        </div>
                        <div class="min-w-0">
                            <p class="text-sm font-semibold text-amber-950">
                                Waiting for landlord approval
                            </p>
                            <p class="mt-1 text-sm text-amber-900/95">
                                {{ me.message }}
                            </p>
                            <p
                                class="mt-3 text-xs leading-relaxed text-amber-800/90"
                            >
                                You can leave this page open or sign out and
                                return later — we’ll show your lease here once
                                your landlord assigns your unit.
                            </p>
                        </div>
                    </div>
                </div>

                <section class="tenant-card mt-6 p-6 sm:p-8">
                    <div class="flex gap-4">
                        <div
                            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-white shadow-lg shadow-teal-900/20"
                            :aria-label="me.fullName || 'Account'"
                        >
                            {{ initials(me.fullName) }}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-xs font-semibold uppercase tracking-widest text-teal-600"
                            >
                                Your details
                            </p>
                            <h1
                                class="mt-1 text-2xl font-bold tracking-tight text-slate-900"
                            >
                                {{ me.fullName || '—' }}
                            </h1>
                            <dl
                                class="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2"
                            >
                                <div v-if="me.email">
                                    <dt
                                        class="text-xs font-medium text-slate-400"
                                    >
                                        Email
                                    </dt>
                                    <dd class="mt-0.5">{{ me.email }}</dd>
                                </div>
                                <div v-if="me.phone">
                                    <dt
                                        class="text-xs font-medium text-slate-400"
                                    >
                                        Phone
                                    </dt>
                                    <dd class="mt-0.5">{{ me.phone }}</dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </section>
            </template>

            <template v-else-if="me?.status === 'rejected'">
                <div
                    class="tenant-card border-red-200/90 bg-red-50/40 p-6"
                    role="alert"
                >
                    <div class="flex gap-3">
                        <div
                            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-lg font-bold text-red-800 ring-1 ring-red-200/80"
                            aria-hidden="true"
                        >
                            !
                        </div>
                        <div>
                            <p class="text-sm font-semibold text-red-950">
                                Registration not approved
                            </p>
                            <p class="mt-2 text-sm text-red-900/95">
                                {{ me.message }}
                            </p>
                        </div>
                    </div>
                </div>
            </template>

            <template v-else-if="me?.status === 'active'">
                <section class="tenant-card p-6 sm:p-8">
                    <div class="flex gap-4">
                        <div
                            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-white shadow-lg shadow-teal-900/20"
                            :aria-label="me.renter.fullName"
                        >
                            {{ initials(me.renter.fullName) }}
                        </div>
                        <div class="min-w-0 flex-1">
                            <p
                                class="text-xs font-semibold uppercase tracking-widest text-teal-600"
                            >
                                Your profile
                            </p>
                            <h1
                                class="mt-1 text-2xl font-bold tracking-tight text-slate-900"
                            >
                                {{ me.renter.fullName }}
                            </h1>
                            <dl
                                class="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2"
                            >
                                <div v-if="me.renter.email">
                                    <dt
                                        class="text-xs font-medium text-slate-400"
                                    >
                                        Email
                                    </dt>
                                    <dd class="mt-0.5 break-all">
                                        {{ me.renter.email }}
                                    </dd>
                                </div>
                                <div v-if="me.renter.phone">
                                    <dt
                                        class="text-xs font-medium text-slate-400"
                                    >
                                        Phone
                                    </dt>
                                    <dd class="mt-0.5">
                                        {{ me.renter.phone }}
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </div>
                </section>

                <section
                    v-if="whatsDueNext.next || pendingProofCount > 0"
                    class="tenant-card mt-6 border border-emerald-200/90 bg-gradient-to-br from-emerald-50/95 to-teal-50/50 p-5 sm:p-6"
                    aria-live="polite"
                >
                    <div class="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p
                                class="text-xs font-semibold uppercase tracking-widest text-emerald-700"
                            >
                                What’s due next
                            </p>
                            <template v-if="whatsDueNext.next">
                                <p
                                    class="mt-2 text-lg font-semibold tracking-tight text-slate-900"
                                >
                                    {{ nextDueTitle(whatsDueNext.next) }}
                                    <span class="font-normal text-slate-600">
                                        ·
                                        {{
                                            money(
                                                whatsDueNext.next.amount,
                                                whatsDueNext.next.currency,
                                            )
                                        }}
                                    </span>
                                </p>
                                <p class="mt-1 text-sm text-slate-600">
                                    {{ whatsDueNext.next.placeLabel }}
                                </p>
                                <p class="mt-0.5 text-sm text-slate-500">
                                    Due
                                    {{
                                        formatDate(whatsDueNext.next.dueDate)
                                    }}
                                    <span
                                        v-if="whatsDueNext.upcomingCount > 1"
                                        class="text-slate-400"
                                    >
                                        · {{ whatsDueNext.upcomingCount - 1 }}
                                        more in queue
                                    </span>
                                </p>
                            </template>
                            <p
                                v-else
                                class="mt-2 text-sm font-medium text-emerald-900"
                            >
                                No open charges right now
                                <span
                                    v-if="pendingProofCount"
                                    class="block pt-1 font-normal text-emerald-800/95"
                                >
                                    {{ pendingProofCount }} receipt(s) are with
                                    your landlord for review.
                                </span>
                            </p>
                            <p
                                v-if="whatsDueNext.next && pendingProofCount"
                                class="mt-2 text-xs text-emerald-900/85"
                            >
                                {{ pendingProofCount }} receipt(s) still
                                awaiting verification.
                            </p>
                        </div>
                        <a
                            v-if="whatsDueNext.next"
                            :href="`#lease-${whatsDueNext.next.leaseId}`"
                            class="inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-300/80 bg-white/90 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50"
                        >
                            Jump to lease
                        </a>
                    </div>
                    <ul
                        v-if="whatsDueNext.timeline.length > 1"
                        class="mt-5 space-y-4 border-l-2 border-emerald-200/90 pl-5"
                        aria-label="Upcoming charges timeline"
                    >
                        <li
                            v-for="(item, idx) in whatsDueNext.timeline"
                            :key="`${item.kind}-${item.dueDate}-${idx}`"
                            class="relative"
                        >
                            <span
                                class="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"
                                aria-hidden="true"
                            />
                            <p class="text-sm font-semibold text-slate-900">
                                {{ nextDueTitle(item) }}
                                <span class="font-normal text-slate-600">
                                    ·
                                    {{ money(item.amount, item.currency) }}
                                </span>
                                <span
                                    v-if="idx === 0"
                                    class="ml-2 rounded-md bg-emerald-600/10 px-1.5 py-0.5 text-xs font-medium text-emerald-800"
                                    >Next</span
                                >
                            </p>
                            <p class="mt-0.5 text-xs text-slate-500">
                                Due {{ formatDate(item.dueDate) }} ·
                                {{ item.placeLabel }}
                            </p>
                        </li>
                    </ul>
                </section>

                <section class="mt-10">
                    <h2
                        class="text-lg font-semibold tracking-tight text-slate-900"
                    >
                        Leases
                    </h2>
                    <p
                        class="mt-2 max-w-prose text-sm leading-relaxed text-slate-600"
                    >
                        Active and past leases linked to your account.                         Each row lists scheduled rent.
                        <strong class="font-semibold text-slate-800">Paid</strong>
                        means the landlord confirmed payment (including prepaid
                        months at lease start). Otherwise upload a receipt photo;
                        it becomes paid in your view only after they verify it.
                    </p>
                    <p
                        v-if="uploadErr"
                        class="mt-3 rounded-xl border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-800"
                    >
                        {{ uploadErr }}
                    </p>

                    <ul v-if="leases.length" class="mt-5 space-y-4">
                        <li
                            v-for="lease in leases"
                            :id="`lease-${lease.id}`"
                            :key="lease.id"
                            class="tenant-card scroll-mt-24 p-5 transition-[box-shadow,border-color] duration-200 sm:p-6 hover:border-slate-300/70 hover:shadow-2xl hover:shadow-slate-200/50"
                        >
                            <div
                                class="flex flex-wrap items-baseline justify-between gap-3"
                            >
                                <div class="min-w-0">
                                    <p class="font-semibold text-slate-900">
                                        {{ lease.unit.property.name }} ·
                                        {{ lease.unit.label }}
                                    </p>
                                    <p
                                        v-if="lease.unit.property.address"
                                        class="mt-0.5 text-xs text-slate-500"
                                    >
                                        {{ lease.unit.property.address }}
                                    </p>
                                </div>
                                <p
                                    class="shrink-0 text-sm font-semibold text-slate-800"
                                >
                                    {{
                                        money(lease.rentAmount, lease.currency)
                                    }}
                                    <span
                                        class="block font-normal text-slate-500 sm:inline sm:pl-1"
                                        >/ month · due day
                                        {{ lease.dueDay }}</span
                                    >
                                </p>
                            </div>
                            <p
                                class="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-100/90 px-3 py-1 text-xs text-slate-600"
                            >
                                <span>{{ formatDate(lease.startDate) }}</span>
                                <span class="text-slate-300" aria-hidden="true"
                                    >—</span
                                >
                                <span>{{
                                    lease.endDate
                                        ? formatDate(lease.endDate)
                                        : 'Ongoing'
                                }}</span>
                            </p>

                            <div
                                class="mt-4 rounded-2xl border border-slate-100 bg-slate-50/90 px-4 py-3 text-xs leading-relaxed text-slate-600"
                            >
                                <p class="font-semibold text-slate-800">
                                    Utilities
                                </p>
                                <ul
                                    class="mt-2 list-inside list-disc space-y-1"
                                >
                                    <li
                                        v-if="
                                            lease.unit.electricityBilling ===
                                            'PREPAID_EXTERNAL'
                                        "
                                    >
                                        Electricity: prepaid (not tracked in
                                        this app).
                                    </li>
                                    <li
                                        v-else-if="
                                            lease.unit.electricityBilling ===
                                            'METERED_KWH'
                                        "
                                    >
                                        Electricity: metered —
                                        <template
                                            v-if="
                                                lease.unit
                                                    .electricityPricePerKwh
                                            "
                                        >
                                            {{
                                                moneyPerKwh(
                                                    lease.unit
                                                        .electricityPricePerKwh,
                                                    lease.currency,
                                                )
                                            }}
                                            per kWh
                                        </template>
                                        <template v-else>
                                            rate not set — ask your
                                            landlord.</template
                                        >
                                    </li>
                                    <li
                                        v-if="
                                            lease.unit.waterBilling === 'NONE'
                                        "
                                    >
                                        Water: not billed through this app.
                                    </li>
                                    <li
                                        v-else-if="
                                            lease.unit.waterBilling ===
                                            'METERED_M3'
                                        "
                                    >
                                        Water: metered —
                                        <template
                                            v-if="lease.unit.waterPricePerM3"
                                        >
                                            {{
                                                money(
                                                    lease.unit.waterPricePerM3,
                                                    lease.currency,
                                                )
                                            }}
                                            per m³
                                        </template>
                                        <template v-else>
                                            rate not set — ask your
                                            landlord.</template
                                        >
                                    </li>
                                </ul>
                            </div>

                            <div
                                v-if="
                                    lease.unit.electricityBilling ===
                                        'METERED_KWH' ||
                                    lease.unit.waterBilling === 'METERED_M3'
                                "
                                class="mt-4 rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/95 via-teal-50/40 to-white p-4 text-xs sm:p-5"
                            >
                                <p class="text-sm font-semibold text-slate-900">
                                    Monthly utility charges
                                </p>
                                <p
                                    class="mt-1 max-w-prose text-[11px] leading-relaxed text-slate-600 sm:text-xs"
                                >
                                    Electricity and water billed each month by
                                    your landlord.
                                </p>
                                <ul
                                    v-if="lease.utilityBills?.length"
                                    class="mt-4 space-y-3"
                                >
                                    <li
                                        v-for="ub in lease.utilityBills"
                                        :key="ub.id"
                                        class="rounded-2xl border border-white/90 bg-white/95 p-4 text-slate-700 shadow-sm shadow-slate-200/35 transition hover:border-emerald-200/75 hover:shadow-md"
                                    >
                                        <div
                                            class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                                        >
                                            <div
                                                class="flex min-w-0 flex-1 gap-3"
                                            >
                                                <div
                                                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset"
                                                    :class="
                                                        ub.kind ===
                                                        'ELECTRICITY'
                                                            ? 'bg-amber-50 text-amber-700 ring-amber-100/90'
                                                            : 'bg-sky-50 text-sky-700 ring-sky-100/90'
                                                    "
                                                    aria-hidden="true"
                                                >
                                                    <BoltIcon
                                                        v-if="
                                                            ub.kind ===
                                                            'ELECTRICITY'
                                                        "
                                                        class="h-5 w-5"
                                                        aria-hidden="true"
                                                    />
                                                    <BeakerIcon
                                                        v-else
                                                        class="h-5 w-5"
                                                        aria-hidden="true"
                                                    />
                                                </div>
                                                <div class="min-w-0">
                                                    <p
                                                        class="text-sm font-semibold text-slate-900"
                                                    >
                                                        {{
                                                            utilityPeriodLabel(
                                                                ub.year,
                                                                ub.month,
                                                            )
                                                        }}
                                                        <span
                                                            class="font-medium text-slate-600"
                                                        >
                                                            ·
                                                            {{
                                                                ub.kind ===
                                                                'ELECTRICITY'
                                                                    ? 'Electricity'
                                                                    : 'Water'
                                                            }}
                                                        </span>
                                                    </p>
                                                    <p
                                                        class="mt-1 text-[11px] leading-relaxed text-slate-600 sm:text-xs"
                                                    >
                                                        Due
                                                        {{
                                                            formatDate(
                                                                ub.dueDate,
                                                            )
                                                        }}
                                                        <template
                                                            v-if="
                                                                ub.consumption &&
                                                                ub.consumption !==
                                                                    ''
                                                            "
                                                        >
                                                            · Used
                                                            {{ ub.consumption }}
                                                            {{
                                                                ub.kind ===
                                                                'ELECTRICITY'
                                                                    ? 'kWh'
                                                                    : 'm³'
                                                            }}
                                                        </template>
                                                        <template
                                                            v-if="
                                                                ub.status ===
                                                                    'PAID' &&
                                                                ub.paidAt
                                                            "
                                                        >
                                                            · Recorded paid
                                                            {{
                                                                formatDate(
                                                                    ub.paidAt,
                                                                )
                                                            }}
                                                        </template>
                                                    </p>
                                                    <p
                                                        v-if="
                                                            ub.proofVerification ===
                                                                'REJECTED' &&
                                                            ub.proofRejectionNote
                                                        "
                                                        class="mt-1.5 text-[11px] text-red-700"
                                                    >
                                                        {{ ub.proofRejectionNote }}
                                                    </p>
                                                </div>
                                            </div>
                                            <div
                                                class="flex w-full flex-col gap-2 border-t border-slate-100 pt-3 sm:w-auto sm:min-w-[8.5rem] sm:border-t-0 sm:pt-0 sm:text-right"
                                            >
                                                <span
                                                    class="text-base font-semibold tabular-nums text-slate-900 sm:text-sm"
                                                    >{{
                                                        money(
                                                            ub.amount,
                                                            ub.currency,
                                                        )
                                                    }}</span
                                                >
                                                <span
                                                    class="inline-flex w-fit rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:ml-auto"
                                                    :class="
                                                        ub.status === 'PAID'
                                                            ? 'bg-emerald-100 text-emerald-900'
                                                            : ub.proofVerification ===
                                                                'PENDING_VERIFICATION'
                                                              ? 'bg-sky-100 text-sky-900'
                                                              : ub.proofVerification ===
                                                                  'REJECTED'
                                                                ? 'bg-red-100 text-red-900'
                                                                : ub.status ===
                                                                    'LATE'
                                                                  ? 'bg-orange-100 text-orange-900'
                                                                  : 'bg-amber-100 text-amber-900'
                                                    "
                                                >
                                                    {{
                                                        utilityProofLabel(ub)
                                                    }}
                                                </span>
                                                <label
                                                    v-if="
                                                        canUploadProof(
                                                            ub.status,
                                                            ub.proofVerification,
                                                        )
                                                    "
                                                    class="tenant-action-link mt-1 w-full sm:ml-auto sm:w-auto"
                                                >
                                                    {{
                                                        uploadBusyKey ===
                                                        `util:${ub.id}`
                                                            ? 'Uploading…'
                                                            : 'Upload receipt'
                                                    }}
                                                    <input
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp"
                                                        class="sr-only"
                                                        :disabled="
                                                            uploadBusyKey !==
                                                            null
                                                        "
                                                        @change="
                                                            onUtilityProofPick(
                                                                $event,
                                                                me.organization
                                                                    .id,
                                                                lease.id,
                                                                ub.id,
                                                            )
                                                        "
                                                    />
                                                </label>
                                            </div>
                                        </div>
                                    </li>
                                </ul>
                                <p
                                    v-else
                                    class="mt-3 rounded-xl border border-dashed border-emerald-200/60 bg-white/50 px-3 py-4 text-center text-slate-600"
                                >
                                    No monthly charges recorded yet.
                                </p>
                            </div>

                            <div
                                v-if="showPaymentHistorySection(lease)"
                                class="mt-5 border-t border-slate-100 pt-4"
                            >
                                <p
                                    class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                                >
                                    Payment history
                                </p>
                                <p
                                    class="mt-1 text-[11px] leading-relaxed text-slate-500"
                                >
                                    Switch between rent and metered utilities to
                                    see past and current charges.
                                </p>
                                <div
                                    v-if="historyTabsForLease(lease).length > 1"
                                    class="mt-3 flex flex-wrap gap-1 rounded-xl bg-slate-100/90 p-1"
                                    role="tablist"
                                    aria-label="Payment history type"
                                >
                                    <button
                                        v-for="tab in historyTabsForLease(lease)"
                                        :key="tab"
                                        type="button"
                                        role="tab"
                                        :aria-selected="
                                            currentHistoryTab(lease) === tab
                                        "
                                        class="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
                                        :class="
                                            currentHistoryTab(lease) === tab
                                                ? 'bg-white text-teal-900 shadow-sm ring-1 ring-slate-200/80'
                                                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                                        "
                                        @click="setHistoryTab(lease.id, tab)"
                                    >
                                        {{ historyTabLabel(tab) }}
                                    </button>
                                </div>

                                <div
                                    v-show="currentHistoryTab(lease) === 'lease'"
                                    class="mt-3"
                                    role="tabpanel"
                                >
                                    <ul
                                        v-if="rentPaymentsNewestFirst(lease).length"
                                        class="space-y-2"
                                    >
                                        <li
                                            v-for="p in rentPaymentsNewestFirst(
                                                lease,
                                            ).slice(0, 36)"
                                            :key="p.id"
                                            class="flex flex-col gap-2 rounded-xl bg-slate-50/90 px-3 py-2 text-sm"
                                        >
                                            <div
                                                class="flex flex-wrap items-center justify-between gap-2"
                                            >
                                                <span class="text-slate-600">{{
                                                    formatDate(p.dueDate)
                                                }}</span>
                                                <span
                                                    class="font-medium text-slate-800"
                                                    >{{
                                                        money(
                                                            p.amount,
                                                            lease.currency,
                                                        )
                                                    }}</span
                                                >
                                                <span
                                                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                                                    :class="
                                                        p.status === 'PAID'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : p.proofVerification ===
                                                                'PENDING_VERIFICATION'
                                                              ? 'bg-sky-100 text-sky-900'
                                                              : p.proofVerification ===
                                                                  'REJECTED'
                                                                ? 'bg-red-100 text-red-900'
                                                                : p.status ===
                                                                    'LATE'
                                                                  ? 'bg-orange-100 text-orange-900'
                                                                  : 'bg-amber-100 text-amber-900'
                                                    "
                                                >
                                                    {{ rentProofLabel(p) }}
                                                </span>
                                            </div>
                                            <p
                                                v-if="
                                                    p.proofVerification ===
                                                        'REJECTED' &&
                                                    p.proofRejectionNote
                                                "
                                                class="text-xs text-red-700"
                                            >
                                                {{ p.proofRejectionNote }}
                                            </p>
                                            <label
                                                v-if="
                                                    canUploadProof(
                                                        p.status,
                                                        p.proofVerification,
                                                    )
                                                "
                                                class="tenant-action-link"
                                            >
                                                {{
                                                    uploadBusyKey ===
                                                    `rent:${p.id}`
                                                        ? 'Uploading…'
                                                        : 'Upload receipt photo'
                                                }}
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp"
                                                    class="sr-only"
                                                    :disabled="
                                                        uploadBusyKey !== null
                                                    "
                                                    @change="
                                                        onRentProofPick(
                                                            $event,
                                                            me.organization.id,
                                                            lease.id,
                                                            p.id,
                                                        )
                                                    "
                                                />
                                            </label>
                                        </li>
                                    </ul>
                                    <p
                                        v-else
                                        class="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center text-xs text-slate-500"
                                    >
                                        No rent charges on file yet.
                                    </p>
                                </div>

                                <div
                                    v-show="
                                        currentHistoryTab(lease) ===
                                        'electricity'
                                    "
                                    class="mt-3"
                                    role="tabpanel"
                                >
                                    <ul
                                        v-if="
                                            utilityBillsByKind(
                                                lease,
                                                'ELECTRICITY',
                                            ).length
                                        "
                                        class="space-y-2"
                                    >
                                        <li
                                            v-for="ub in utilityBillsByKind(
                                                lease,
                                                'ELECTRICITY',
                                            )"
                                            :key="ub.id"
                                            class="flex flex-col gap-2 rounded-xl bg-slate-50/90 px-3 py-2 text-sm"
                                        >
                                            <div
                                                class="flex flex-wrap items-start justify-between gap-2"
                                            >
                                                <div>
                                                    <p
                                                        class="font-medium text-slate-900"
                                                    >
                                                        {{
                                                            utilityPeriodLabel(
                                                                ub.year,
                                                                ub.month,
                                                            )
                                                        }}
                                                        <span
                                                            class="font-normal text-slate-500"
                                                        >
                                                            · Electricity</span
                                                        >
                                                    </p>
                                                    <p
                                                        class="mt-1 text-[11px] text-slate-500"
                                                    >
                                                        Due
                                                        {{
                                                            formatDate(
                                                                ub.dueDate,
                                                            )
                                                        }}
                                                        <template
                                                            v-if="
                                                                ub.consumption &&
                                                                ub.consumption !==
                                                                    ''
                                                            "
                                                        >
                                                            · Used
                                                            {{ ub.consumption }}
                                                            kWh
                                                        </template>
                                                        <template
                                                            v-if="
                                                                ub.status ===
                                                                    'PAID' &&
                                                                ub.paidAt
                                                            "
                                                        >
                                                            · Recorded paid
                                                            {{
                                                                formatDate(
                                                                    ub.paidAt,
                                                                )
                                                            }}
                                                        </template>
                                                    </p>
                                                    <p
                                                        v-if="
                                                            ub.proofVerification ===
                                                                'REJECTED' &&
                                                            ub.proofRejectionNote
                                                        "
                                                        class="mt-1 text-[11px] text-red-700"
                                                    >
                                                        {{ ub.proofRejectionNote }}
                                                    </p>
                                                </div>
                                                <div
                                                    class="flex shrink-0 flex-col items-end gap-1"
                                                >
                                                    <span
                                                        class="font-semibold tabular-nums text-slate-800"
                                                        >{{
                                                            money(
                                                                ub.amount,
                                                                ub.currency,
                                                            )
                                                        }}</span
                                                    >
                                                    <span
                                                        class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                                        :class="
                                                            ub.status ===
                                                            'PAID'
                                                                ? 'bg-emerald-100 text-emerald-900'
                                                                : ub.proofVerification ===
                                                                    'PENDING_VERIFICATION'
                                                                  ? 'bg-sky-100 text-sky-900'
                                                                  : ub.proofVerification ===
                                                                      'REJECTED'
                                                                    ? 'bg-red-100 text-red-900'
                                                                    : ub.status ===
                                                                        'LATE'
                                                                      ? 'bg-orange-100 text-orange-900'
                                                                      : 'bg-amber-100 text-amber-900'
                                                        "
                                                    >
                                                        {{
                                                            utilityProofLabel(
                                                                ub,
                                                            )
                                                        }}
                                                    </span>
                                                    <label
                                                        v-if="
                                                            canUploadProof(
                                                                ub.status,
                                                                ub.proofVerification,
                                                            )
                                                        "
                                                        class="tenant-action-link mt-1 self-start"
                                                    >
                                                        {{
                                                            uploadBusyKey ===
                                                            `util:${ub.id}`
                                                                ? 'Uploading…'
                                                                : 'Upload receipt'
                                                        }}
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            class="sr-only"
                                                            :disabled="
                                                                uploadBusyKey !==
                                                                null
                                                            "
                                                            @change="
                                                                onUtilityProofPick(
                                                                    $event,
                                                                    me.organization
                                                                        .id,
                                                                    lease.id,
                                                                    ub.id,
                                                                )
                                                            "
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                    <p
                                        v-else
                                        class="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center text-xs text-slate-500"
                                    >
                                        No electricity charges recorded yet.
                                    </p>
                                </div>

                                <div
                                    v-show="
                                        currentHistoryTab(lease) === 'water'
                                    "
                                    class="mt-3"
                                    role="tabpanel"
                                >
                                    <ul
                                        v-if="
                                            utilityBillsByKind(
                                                lease,
                                                'WATER',
                                            ).length
                                        "
                                        class="space-y-2"
                                    >
                                        <li
                                            v-for="ub in utilityBillsByKind(
                                                lease,
                                                'WATER',
                                            )"
                                            :key="ub.id"
                                            class="flex flex-col gap-2 rounded-xl bg-slate-50/90 px-3 py-2 text-sm"
                                        >
                                            <div
                                                class="flex flex-wrap items-start justify-between gap-2"
                                            >
                                                <div>
                                                    <p
                                                        class="font-medium text-slate-900"
                                                    >
                                                        {{
                                                            utilityPeriodLabel(
                                                                ub.year,
                                                                ub.month,
                                                            )
                                                        }}
                                                        <span
                                                            class="font-normal text-slate-500"
                                                        >
                                                            · Water</span
                                                        >
                                                    </p>
                                                    <p
                                                        class="mt-1 text-[11px] text-slate-500"
                                                    >
                                                        Due
                                                        {{
                                                            formatDate(
                                                                ub.dueDate,
                                                            )
                                                        }}
                                                        <template
                                                            v-if="
                                                                ub.consumption &&
                                                                ub.consumption !==
                                                                    ''
                                                            "
                                                        >
                                                            · Used
                                                            {{ ub.consumption }}
                                                            m³
                                                        </template>
                                                        <template
                                                            v-if="
                                                                ub.status ===
                                                                    'PAID' &&
                                                                ub.paidAt
                                                            "
                                                        >
                                                            · Recorded paid
                                                            {{
                                                                formatDate(
                                                                    ub.paidAt,
                                                                )
                                                            }}
                                                        </template>
                                                    </p>
                                                    <p
                                                        v-if="
                                                            ub.proofVerification ===
                                                                'REJECTED' &&
                                                            ub.proofRejectionNote
                                                        "
                                                        class="mt-1 text-[11px] text-red-700"
                                                    >
                                                        {{ ub.proofRejectionNote }}
                                                    </p>
                                                </div>
                                                <div
                                                    class="flex shrink-0 flex-col items-end gap-1"
                                                >
                                                    <span
                                                        class="font-semibold tabular-nums text-slate-800"
                                                        >{{
                                                            money(
                                                                ub.amount,
                                                                ub.currency,
                                                            )
                                                        }}</span
                                                    >
                                                    <span
                                                        class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                                                        :class="
                                                            ub.status ===
                                                            'PAID'
                                                                ? 'bg-emerald-100 text-emerald-900'
                                                                : ub.proofVerification ===
                                                                    'PENDING_VERIFICATION'
                                                                  ? 'bg-sky-100 text-sky-900'
                                                                  : ub.proofVerification ===
                                                                      'REJECTED'
                                                                    ? 'bg-red-100 text-red-900'
                                                                    : ub.status ===
                                                                        'LATE'
                                                                      ? 'bg-orange-100 text-orange-900'
                                                                      : 'bg-amber-100 text-amber-900'
                                                        "
                                                    >
                                                        {{
                                                            utilityProofLabel(
                                                                ub,
                                                            )
                                                        }}
                                                    </span>
                                                    <label
                                                        v-if="
                                                            canUploadProof(
                                                                ub.status,
                                                                ub.proofVerification,
                                                            )
                                                        "
                                                        class="tenant-action-link mt-1 self-start"
                                                    >
                                                        {{
                                                            uploadBusyKey ===
                                                            `util:${ub.id}`
                                                                ? 'Uploading…'
                                                                : 'Upload receipt'
                                                        }}
                                                        <input
                                                            type="file"
                                                            accept="image/jpeg,image/png,image/webp"
                                                            class="sr-only"
                                                            :disabled="
                                                                uploadBusyKey !==
                                                                null
                                                            "
                                                            @change="
                                                                onUtilityProofPick(
                                                                    $event,
                                                                    me.organization
                                                                        .id,
                                                                    lease.id,
                                                                    ub.id,
                                                                )
                                                            "
                                                        />
                                                    </label>
                                                </div>
                                            </div>
                                        </li>
                                    </ul>
                                    <p
                                        v-else
                                        class="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-6 text-center text-xs text-slate-500"
                                    >
                                        No water charges recorded yet.
                                    </p>
                                </div>
                            </div>
                        </li>
                    </ul>
                    <div
                        v-else
                        class="tenant-card mt-5 border-dashed border-slate-300/80 bg-slate-50/50 px-4 py-12 text-center"
                    >
                        <p class="text-sm font-medium text-slate-700">
                            No leases on file yet
                        </p>
                        <p class="mt-1 text-xs text-slate-500">
                            When your landlord adds a lease, it will appear
                            here.
                        </p>
                    </div>
                </section>
            </template>

            <section
                v-if="
                    !loading &&
                    !error &&
                    me &&
                    (me.status === 'active' || me.status === 'pending')
                "
                id="tenant-support-section"
                class="tenant-card mt-10 p-6 sm:p-8"
            >
                <h2 class="text-base font-semibold text-slate-900">
                    Support requests
                </h2>
                <p
                    class="mt-2 max-w-prose text-xs leading-relaxed text-slate-500"
                >
                    Send a new message from the account menu (<span
                        class="font-medium text-slate-600"
                        >Support request</span
                    >) for billing, access, or platform issues. Your landlord is
                    still the first contact for unit-specific matters. When the
                    platform team resolves your ticket, their reply appears
                    below.
                </p>

                <div
                    v-if="supportOk"
                    class="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900"
                    role="status"
                >
                    Thanks — your request was sent. We’ll get back to you as
                    soon as we can.
                </div>

                <p
                    v-if="!supportTickets.length"
                    class="mt-5 rounded-2xl border border-dashed border-slate-200/90 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500"
                >
                    No requests yet.
                </p>

                <div
                    v-if="supportTickets.length"
                    class="mt-6 border-t border-slate-100 pt-6"
                >
                    <p
                        class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                    >
                        Your requests
                    </p>
                    <ul class="mt-4 space-y-3">
                        <li
                            v-for="t in supportTickets"
                            :key="t.id"
                            class="rounded-2xl border border-slate-100 bg-slate-50/90 p-4 text-sm shadow-sm"
                        >
                            <div
                                class="flex flex-wrap items-baseline justify-between gap-2"
                            >
                                <span class="font-medium text-slate-900">{{
                                    t.subject
                                }}</span>
                                <span
                                    class="rounded-full px-2 py-0.5 text-xs font-medium"
                                    :class="
                                        t.status === 'OPEN'
                                            ? 'bg-blue-100 text-blue-900'
                                            : t.status === 'IN_PROGRESS'
                                              ? 'bg-amber-100 text-amber-900'
                                              : 'bg-slate-100 text-slate-700'
                                    "
                                >
                                    {{ t.status }}
                                </span>
                            </div>
                            <p
                                class="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-600"
                            >
                                {{ t.message }}
                            </p>
                            <div
                                v-if="
                                    t.resolutionNote &&
                                    (t.status === 'RESOLVED' ||
                                        t.status === 'CLOSED')
                                "
                                class="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/90 px-3 py-2 text-xs leading-relaxed text-emerald-950"
                            >
                                <p
                                    class="font-semibold text-emerald-900"
                                >
                                    Platform reply
                                </p>
                                <p class="mt-1 whitespace-pre-wrap">
                                    {{ t.resolutionNote }}
                                </p>
                            </div>
                            <p class="mt-3 text-xs text-slate-400">
                                {{ formatDate(t.createdAt) }}
                            </p>
                        </li>
                    </ul>
                </div>
            </section>
        </main>

        <TenantModal
            v-if="headerShowPassword"
            v-model:open="passwordModalOpen"
            title="Change password"
        >
            <form class="space-y-3" @submit.prevent="changePassword">
                <label class="block text-sm">
                    <span class="text-slate-700">Current password</span>
                    <input
                        v-model="pwdCurrent"
                        type="password"
                        required
                        autocomplete="current-password"
                        class="tenant-input mt-1.5"
                    />
                </label>
                <label class="block text-sm">
                    <span class="text-slate-700">New password</span>
                    <input
                        v-model="pwdNew"
                        type="password"
                        required
                        minlength="8"
                        autocomplete="new-password"
                        class="tenant-input mt-1.5"
                    />
                </label>
                <p v-if="pwdMsg" class="text-sm text-emerald-700">
                    {{ pwdMsg }}
                </p>
                <p v-if="pwdErr" class="text-sm text-red-600">{{ pwdErr }}</p>
                <button
                    type="submit"
                    class="tenant-btn-primary"
                    :disabled="pwdSaving"
                >
                    {{ pwdSaving ? 'Saving…' : 'Update password' }}
                </button>
            </form>
        </TenantModal>

        <TenantModal
            v-if="headerShowSupport"
            v-model:open="supportModalOpen"
            title="Support request"
        >
            <p class="mb-4 text-xs leading-relaxed text-slate-500">
                Describe your issue for the platform team. Replies go to the
                email on your account when available.
            </p>
            <form class="space-y-3" @submit.prevent="onSubmitSupport">
                <label class="block text-sm">
                    <span class="text-slate-700">Subject</span>
                    <input
                        v-model="supportSubject"
                        type="text"
                        required
                        maxlength="200"
                        class="tenant-input mt-1.5"
                    />
                </label>
                <label class="block text-sm">
                    <span class="text-slate-700">Message</span>
                    <textarea
                        v-model="supportMessage"
                        required
                        rows="4"
                        maxlength="8000"
                        class="tenant-input mt-1.5 min-h-[7rem] resize-y"
                    />
                </label>
                <p v-if="supportErr" class="text-sm text-red-600">
                    {{ supportErr }}
                </p>
                <button
                    type="submit"
                    class="tenant-btn-primary"
                    :disabled="supportBusy"
                >
                    {{ supportBusy ? 'Sending…' : 'Send request' }}
                </button>
            </form>
        </TenantModal>
    </div>
</template>
