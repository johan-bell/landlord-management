<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const renterId = ref('');
const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
  loading.value = true;
  error.value = null;
  try {
    const res = await api<{ access_token: string; renterId: string }>('/tenant/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        renterId: renterId.value.trim(),
        email: email.value.trim(),
        password: password.value,
      }),
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
          Use the renter ID your landlord shared. Your email must match the profile.
        </p>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block">
          <span class="text-sm font-medium text-slate-700">Renter ID</span>
          <input
            v-model="renterId"
            type="text"
            required
            minlength="10"
            autocomplete="off"
            class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            placeholder="e.g. from your invite"
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
          :disabled="loading"
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
