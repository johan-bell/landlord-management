<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import type { AuthUser } from '../stores/auth';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
    loading.value = true;
    error.value = null;
    try {
        const res = await api<{ access_token: string; user: AuthUser }>(
            '/auth/login',
            {
                method: 'POST',
                body: JSON.stringify({
                    email: email.value.trim(),
                    password: password.value,
                }),
            },
        );
        if (!res.user.isPlatformAdmin) {
            error.value = 'This account is not a platform administrator.';
            return;
        }
        auth.setSession(res.access_token, res.user);
        const redirect = (route.query.redirect as string) || '/';
        await router.replace(redirect);
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Login failed';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-screen flex-col justify-center px-4">
        <div
            class="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
            <div class="mb-6 text-center">
                <div
                    class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white"
                >
                    LM
                </div>
                <h1 class="text-xl font-semibold text-slate-900">
                    Platform console
                </h1>
                <p class="mt-1 text-sm text-slate-500">SaaS operator access</p>
                <p class="mt-3 text-xs leading-relaxed text-slate-500">
                    Use a
                    <span class="font-medium text-slate-600"
                        >platform administrator</span
                    >
                    account. Landlord and renter logins cannot open this
                    console.
                </p>
            </div>
            <form class="space-y-4" @submit.prevent="submit">
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Email</span
                    >
                    <input
                        v-model="email"
                        type="email"
                        required
                        autocomplete="email"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Password</span
                    >
                    <input
                        v-model="password"
                        type="password"
                        required
                        autocomplete="current-password"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </label>
                <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
                <button
                    type="submit"
                    class="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    :disabled="loading"
                >
                    {{ loading ? 'Signing in…' : 'Sign in' }}
                </button>
            </form>
        </div>
    </div>
</template>
