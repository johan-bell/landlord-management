<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';

const route = useRoute();
const router = useRouter();

const token = ref('');
const password = ref('');
const loading = ref(false);
const error = ref<string | null>(null);

onMounted(() => {
    const q = route.query.token;
    token.value = typeof q === 'string' ? q : '';
});

async function submit() {
    loading.value = true;
    error.value = null;
    try {
        await api('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({
                token: token.value.trim(),
                password: password.value,
            }),
        });
        await router.replace('/login');
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Reset failed';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="flex min-h-screen flex-col justify-center bg-slate-50 px-4">
        <div
            class="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
            <h1 class="text-xl font-semibold text-slate-900">Choose new password</h1>
            <p class="mt-1 text-sm text-slate-500">
                Use at least 8 characters. You can sign in afterward with your
                email and this password.
            </p>
            <form class="mt-6 space-y-4" @submit.prevent="submit">
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Reset token</span
                    >
                    <input
                        v-model="token"
                        type="text"
                        required
                        autocomplete="one-time-code"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >New password</span
                    >
                    <input
                        v-model="password"
                        type="password"
                        required
                        minlength="8"
                        autocomplete="new-password"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </label>
                <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
                <button
                    type="submit"
                    class="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    :disabled="loading || !token.trim()"
                >
                    {{ loading ? 'Saving…' : 'Update password' }}
                </button>
            </form>
            <p class="mt-6 text-center text-sm text-slate-500">
                <RouterLink
                    to="/login"
                    class="font-medium text-emerald-600 hover:text-emerald-700"
                >
                    Sign in
                </RouterLink>
            </p>
        </div>
    </div>
</template>
