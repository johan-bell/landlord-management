<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

type MeActive = {
  status: 'active';
  renter: { id: string; fullName: string; phone: string | null; email: string | null };
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

type LeaseRow = {
  id: string;
  startDate: string;
  endDate: string | null;
  rentAmount: string;
  currency: string;
  dueDay: number;
  unit: {
    label: string;
    property: { name: string; address: string | null };
  };
  payments: {
    id: string;
    dueDate: string;
    amount: string;
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

let pollTimer: ReturnType<typeof setInterval> | null = null;

function money(amount: string, currency: string) {
  const n = Number(amount);
  if (Number.isNaN(n)) return `${amount} ${currency}`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
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

function logout() {
  auth.clearSession();
  void router.push('/login');
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
    pwdErr.value = e instanceof Error ? e.message : 'Could not update password';
  } finally {
    pwdSaving.value = false;
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
    error.value = e instanceof Error ? e.message : 'Could not load your account';
  } finally {
    loading.value = false;
  }
});

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer);
});
</script>

<template>
  <div class="min-h-screen px-4 pb-12 pt-8 sm:px-6">
    <header class="mx-auto flex max-w-2xl items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-lg shadow-teal-900/20"
        >
          LM
        </div>
        <div class="min-w-0">
          <span class="text-sm font-semibold text-slate-800">Tenant</span>
          <p v-if="me" class="truncate text-xs text-slate-500">{{ me.organization.name }}</p>
        </div>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white"
        @click="logout"
      >
        Sign out
      </button>
    </header>

    <main class="mx-auto mt-8 max-w-2xl">
      <div
        v-if="loading"
        class="rounded-3xl border border-white/60 bg-white/80 p-10 text-center text-sm text-slate-600 shadow-xl shadow-slate-200/50"
      >
        Loading…
      </div>
      <div
        v-else-if="error"
        class="rounded-3xl border border-red-100 bg-red-50/90 p-6 shadow-sm"
        role="alert"
      >
        <p class="font-medium text-red-900">Something went wrong</p>
        <p class="mt-2 text-sm text-red-800">{{ error }}</p>
        <p class="mt-3 text-xs text-red-700/90">
          If this keeps happening, confirm the API is running and your account still has access.
        </p>
      </div>

      <template v-else-if="me?.status === 'pending'">
        <div
          class="rounded-3xl border border-amber-200 bg-amber-50/90 p-6 shadow-sm"
          role="status"
        >
          <p class="text-sm font-semibold text-amber-950">Waiting for landlord approval</p>
          <p class="mt-2 text-sm text-amber-900/95">{{ me.message }}</p>
          <p class="mt-3 text-xs text-amber-800/90">
            You can leave this page open or sign out and return later — we’ll show your lease here once your landlord
            assigns your unit.
          </p>
        </div>

        <section class="mt-6 rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
          <p class="text-xs font-semibold uppercase tracking-widest text-teal-600">Your details</p>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">{{ me.fullName || '—' }}</h1>
          <dl class="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <div v-if="me.email">
              <dt class="text-xs text-slate-400">Email</dt>
              <dd>{{ me.email }}</dd>
            </div>
            <div v-if="me.phone">
              <dt class="text-xs text-slate-400">Phone</dt>
              <dd>{{ me.phone }}</dd>
            </div>
          </dl>
        </section>

        <section class="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
          <h2 class="text-sm font-semibold text-slate-900">Change password</h2>
          <form class="mt-4 space-y-3" @submit.prevent="changePassword">
            <label class="block text-sm">
              <span class="text-slate-700">Current password</span>
              <input
                v-model="pwdCurrent"
                type="password"
                required
                autocomplete="current-password"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
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
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <p v-if="pwdMsg" class="text-sm text-emerald-700">{{ pwdMsg }}</p>
            <p v-if="pwdErr" class="text-sm text-red-600">{{ pwdErr }}</p>
            <button
              type="submit"
              class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              :disabled="pwdSaving"
            >
              {{ pwdSaving ? 'Saving…' : 'Update password' }}
            </button>
          </form>
        </section>
      </template>

      <template v-else-if="me?.status === 'rejected'">
        <div class="rounded-3xl border border-red-200 bg-red-50/90 p-6 shadow-sm" role="alert">
          <p class="text-sm font-semibold text-red-950">Registration not approved</p>
          <p class="mt-2 text-sm text-red-900/95">{{ me.message }}</p>
        </div>
      </template>

      <template v-else-if="me?.status === 'active'">
        <section class="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
          <p class="text-xs font-semibold uppercase tracking-widest text-teal-600">Your profile</p>
          <h1 class="mt-1 text-2xl font-bold tracking-tight text-slate-900">{{ me.renter.fullName }}</h1>
          <dl class="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
            <div v-if="me.renter.email">
              <dt class="text-xs text-slate-400">Email</dt>
              <dd>{{ me.renter.email }}</dd>
            </div>
            <div v-if="me.renter.phone">
              <dt class="text-xs text-slate-400">Phone</dt>
              <dd>{{ me.renter.phone }}</dd>
            </div>
          </dl>
        </section>

        <section class="mt-6 rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-sm">
          <h2 class="text-sm font-semibold text-slate-900">Change password</h2>
          <form class="mt-4 space-y-3" @submit.prevent="changePassword">
            <label class="block text-sm">
              <span class="text-slate-700">Current password</span>
              <input
                v-model="pwdCurrent"
                type="password"
                required
                autocomplete="current-password"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
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
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <p v-if="pwdMsg" class="text-sm text-emerald-700">{{ pwdMsg }}</p>
            <p v-if="pwdErr" class="text-sm text-red-600">{{ pwdErr }}</p>
            <button
              type="submit"
              class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              :disabled="pwdSaving"
            >
              {{ pwdSaving ? 'Saving…' : 'Update password' }}
            </button>
          </form>
        </section>

        <section class="mt-8">
          <h2 class="text-lg font-semibold text-slate-900">Leases</h2>
          <p class="mt-1 text-sm text-slate-500">
            Active and past leases linked to your account. Each row lists scheduled rent; <strong>PAID</strong> means
            that period is settled (including months your landlord marked as prepaid when the lease started).
          </p>

          <ul v-if="leases.length" class="mt-4 space-y-4">
            <li
              v-for="lease in leases"
              :key="lease.id"
              class="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-sm"
            >
              <div class="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <p class="font-medium text-slate-900">
                    {{ lease.unit.property.name }} · {{ lease.unit.label }}
                  </p>
                  <p v-if="lease.unit.property.address" class="text-xs text-slate-500">
                    {{ lease.unit.property.address }}
                  </p>
                </div>
                <p class="text-sm font-semibold text-slate-800">
                  {{ money(lease.rentAmount, lease.currency) }}
                  <span class="font-normal text-slate-500">/ month · due {{ lease.dueDay }}</span>
                </p>
              </div>
              <p class="mt-2 text-xs text-slate-500">
                {{ formatDate(lease.startDate) }}
                —
                {{ lease.endDate ? formatDate(lease.endDate) : 'Ongoing' }}
              </p>

              <div v-if="lease.payments.length" class="mt-4 border-t border-slate-100 pt-3">
                <p class="text-xs font-medium uppercase tracking-wide text-slate-400">Recent payments</p>
                <ul class="mt-2 space-y-1.5">
                  <li
                    v-for="p in lease.payments.slice(0, 5)"
                    :key="p.id"
                    class="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <span class="text-slate-600">{{ formatDate(p.dueDate) }}</span>
                    <span class="font-medium text-slate-800">{{ money(p.amount, lease.currency) }}</span>
                    <span
                      class="rounded-full px-2 py-0.5 text-xs font-medium"
                      :class="
                        p.status === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : p.status === 'LATE'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-700'
                      "
                    >
                      {{ p.status }}
                    </span>
                  </li>
                </ul>
              </div>
            </li>
          </ul>
          <p
            v-else
            class="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600"
          >
            No leases on file yet.
          </p>
        </section>
      </template>
    </main>
  </div>
</template>
