<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../lib/api';

const email = ref('');
const loading = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);

async function submit() {
    loading.value = true;
    message.value = null;
    error.value = null;
    try {
        await api('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: email.value.trim() }),
        });
        message.value =
            'If an account exists for that email, we sent reset instructions.';
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Request failed';
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
            <h1 class="text-xl font-semibold text-slate-900">Reset password</h1>
            <p class="mt-1 text-sm text-slate-500">
                Enter your staff account email. We will send a link when SMTP is
                configured and the address matches an admin user.
            </p>
            <form class="mt-6 space-y-4" @submit.prevent="submit">
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Email</span
                    >
                    <input
                        v-model="email"
                        type="email"
                        required
                        autocomplete="email"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </label>
                <p v-if="message" class="text-sm text-emerald-700">
                    {{ message }}
                </p>
                <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
                <button
                    type="submit"
                    class="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    :disabled="loading"
                >
                    {{ loading ? 'Sending…' : 'Send reset link' }}
                </button>
            </form>
            <p class="mt-6 text-center text-sm text-slate-500">
                <RouterLink
                    to="/login"
                    class="font-medium text-emerald-600 hover:text-emerald-700"
                >
                    Back to sign in
                </RouterLink>
            </p>
        </div>
    </div>
</template>
