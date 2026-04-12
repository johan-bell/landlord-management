<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const inviteToken = ref('');
const renterId = ref('');
const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);
const preview = ref<{ fullName: string; emailHint: string | null } | null>(null);
const previewError = ref<string | null>(null);

const useInvite = () => Boolean(inviteToken.value.trim());

async function loadPreview() {
  const t = inviteToken.value.trim();
  if (!t) {
    preview.value = null;
    previewError.value = null;
    return;
  }
  previewError.value = null;
  try {
    preview.value = await api<{ fullName: string; emailHint: string | null }>(
      `/tenant/invites/preview?token=${encodeURIComponent(t)}`,
    );
  } catch (e) {
    preview.value = null;
    previewError.value = e instanceof Error ? e.message : 'Invalid invite';
  }
}

onMounted(() => {
  const q = route.query.token;
  if (typeof q === 'string' && q) {
    inviteToken.value = q;
  }
  void loadPreview();
});

watch(inviteToken, () => void loadPreview());

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    const body: Record<string, string> = {
      email: email.value.trim(),
      password: password.value,
    };
    if (useInvite()) {
      body.inviteToken = inviteToken.value.trim();
    } else {
      body.renterId = renterId.value.trim();
    }
    const res = await api<{ access_token: string; renterId: string }>('/tenant/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    auth.setSession(res.access_token, res.renterId);
    await router.replace('/');
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Registration failed';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col justify-center px-4 pb-12 pt-8">
    <div class="mx-auto w-full max-w-md rounded-3xl border border-white/60 bg-white/90 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
      <div class="mb-6 text-center">
        <div
          class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-lg font-bold text-white shadow-lg shadow-teal-900/20"
        >
          LM
        </div>
        <h1 class="text-xl font-semibold text-slate-900">Claim your renter profile</h1>
        <p class="mt-1 text-sm text-slate-500">
          Open the invite link from your landlord, or enter your renter ID. Your email must match the profile.
        </p>
      </div>

      <div
        v-if="preview"
        class="mb-4 rounded-2xl border border-teal-100 bg-teal-50/80 px-4 py-3 text-left text-sm text-slate-700"
      >
        <p class="font-medium text-slate-900">{{ preview.fullName }}</p>
        <p v-if="preview.emailHint" class="mt-1 text-xs text-slate-600">Email hint: {{ preview.emailHint }}</p>
      </div>
      <p v-else-if="previewError && useInvite()" class="mb-4 text-sm text-amber-800">{{ previewError }}</p>

      <form class="space-y-4" @submit.prevent="submit">
        <label v-if="!useInvite()" class="block">
          <span class="text-sm font-medium text-slate-700">Renter ID</span>
          <input
            v-model="renterId"
            type="text"
            minlength="10"
            autocomplete="off"
            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            placeholder="From your landlord"
          />
        </label>
        <label v-else class="block">
          <span class="text-sm font-medium text-slate-700">Invite token</span>
          <input
            v-model="inviteToken"
            type="text"
            autocomplete="off"
            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            placeholder="Pasted from invite link"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Email</span>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Password</span>
          <input
            v-model="password"
            type="password"
            required
            minlength="8"
            autocomplete="new-password"
            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </label>
        <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
        <button
          type="submit"
          class="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          :disabled="loading || (!useInvite() && !renterId.trim())"
        >
          {{ loading ? 'Creating account…' : 'Create account' }}
        </button>
      </form>
      <p class="mt-6 text-center text-sm text-slate-500">
        Already have access?
        <RouterLink to="/login" class="font-medium text-teal-600 hover:text-teal-700">Sign in</RouterLink>
      </p>
    </div>
  </div>
</template>
