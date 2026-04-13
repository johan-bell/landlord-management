<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../lib/api';
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

function utilityStatusLabel(status: string) {
    if (status === 'PAID') return 'Paid';
    if (status === 'PENDING') return 'Unpaid';
    return status;
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
                class="mx-auto flex max-w-2xl items-center justify-between gap-3"
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

        <main class="mx-auto max-w-2xl px-4 pt-8 sm:px-6">
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

                <section class="mt-10">
                    <h2
                        class="text-lg font-semibold tracking-tight text-slate-900"
                    >
                        Leases
                    </h2>
                    <p
                        class="mt-2 max-w-prose text-sm leading-relaxed text-slate-600"
                    >
                        Active and past leases linked to your account. Each row
                        lists scheduled rent;
                        <strong class="font-semibold text-slate-800"
                            >PAID</strong
                        >
                        means that period is settled (including months your
                        landlord marked as prepaid when the lease started).
                    </p>

                    <ul v-if="leases.length" class="mt-5 space-y-4">
                        <li
                            v-for="lease in leases"
                            :key="lease.id"
                            class="tenant-card p-5 sm:p-6"
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
                                class="mt-4 rounded-2xl border border-teal-100/90 bg-gradient-to-br from-teal-50/60 to-white px-4 py-3 text-xs"
                            >
                                <p class="font-semibold text-slate-800">
                                    Monthly utility charges
                                </p>
                                <p class="mt-0.5 text-[11px] text-slate-500">
                                    Electricity and water billed each month by
                                    your landlord.
                                </p>
                                <ul
                                    v-if="lease.utilityBills?.length"
                                    class="mt-3 space-y-2"
                                >
                                    <li
                                        v-for="ub in lease.utilityBills"
                                        :key="ub.id"
                                        class="rounded-xl border border-slate-100/90 bg-white/90 px-3 py-2.5 text-slate-700 shadow-sm"
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
                                                    class="mt-1 text-[11px] text-slate-500"
                                                >
                                                    Due
                                                    {{ formatDate(ub.dueDate) }}
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
                                                        ub.status === 'PAID'
                                                            ? 'bg-emerald-100 text-emerald-900'
                                                            : ub.status ===
                                                                'LATE'
                                                              ? 'bg-amber-100 text-amber-900'
                                                              : 'bg-slate-200 text-slate-800'
                                                    "
                                                >
                                                    {{
                                                        utilityStatusLabel(
                                                            ub.status,
                                                        )
                                                    }}
                                                </span>
                                            </div>
                                        </div>
                                    </li>
                                </ul>
                                <p v-else class="mt-2 text-slate-500">
                                    No monthly charges recorded yet.
                                </p>
                            </div>

                            <div
                                v-if="lease.payments.length"
                                class="mt-5 border-t border-slate-100 pt-4"
                            >
                                <p
                                    class="text-xs font-semibold uppercase tracking-wide text-slate-400"
                                >
                                    Recent payments
                                </p>
                                <ul class="mt-3 space-y-2">
                                    <li
                                        v-for="p in lease.payments.slice(0, 5)"
                                        :key="p.id"
                                        class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/90 px-3 py-2 text-sm"
                                    >
                                        <span class="text-slate-600">{{
                                            formatDate(p.dueDate)
                                        }}</span>
                                        <span
                                            class="font-medium text-slate-800"
                                            >{{
                                                money(p.amount, lease.currency)
                                            }}</span
                                        >
                                        <span
                                            class="rounded-full px-2 py-0.5 text-xs font-medium"
                                            :class="
                                                p.status === 'PAID'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : p.status === 'LATE'
                                                      ? 'bg-amber-100 text-amber-900'
                                                      : 'bg-slate-200 text-slate-700'
                                            "
                                        >
                                            {{ p.status }}
                                        </span>
                                    </li>
                                </ul>
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
                    still the first contact for unit-specific matters.
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
                                              : 'bg-slate-200 text-slate-800'
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
