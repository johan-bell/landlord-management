<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../lib/api';
import type { AuthUser } from '../stores/auth';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const name = ref('');
const organizationName = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

async function submit() {
    loading.value = true;
    error.value = null;
    try {
        const res = await api<{
            access_token: string;
            user: AuthUser;
            organization: { id: string };
        }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: email.value.trim(),
                password: password.value,
                name: name.value.trim() || undefined,
                organizationName: organizationName.value.trim(),
            }),
        });
        auth.setSession(res.access_token, res.user);
        await router.replace('/');
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Registration failed';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div
        class="flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-10"
    >
        <div
            class="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
            <h1 class="text-xl font-semibold text-slate-900">Create account</h1>
            <p class="mt-1 text-sm text-slate-500">
                Your first organization is created for you.
            </p>
            <form class="mt-6 space-y-4" @submit.prevent="submit">
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Organization name</span
                    >
                    <input
                        v-model="organizationName"
                        required
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                        placeholder="Douala Rentals"
                    />
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Your name</span
                    >
                    <input
                        v-model="name"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Email</span
                    >
                    <input
                        v-model="email"
                        type="email"
                        required
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-slate-700"
                        >Password (min 8)</span
                    >
                    <input
                        v-model="password"
                        type="password"
                        required
                        minlength="8"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
                    />
                </label>
                <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
                <button
                    type="submit"
                    class="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    :disabled="loading"
                >
                    {{ loading ? 'Creating…' : 'Register' }}
                </button>
            </form>
            <p class="mt-6 text-center text-sm text-slate-500">
                Already have an account?
                <RouterLink to="/login" class="font-medium text-emerald-600"
                    >Sign in</RouterLink
                >
            </p>
        </div>
    </div>
</template>
