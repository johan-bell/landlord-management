<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../lib/api';
import TenantMark from '../components/TenantMark.vue';

const email = ref('');
const loading = ref(false);
const message = ref<string | null>(null);
const error = ref<string | null>(null);

async function submit() {
    loading.value = true;
    message.value = null;
    error.value = null;
    try {
        await api('/tenant/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: email.value.trim() }),
        });
        message.value =
            'If a tenant portal account exists for that email, we sent reset instructions.';
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Request failed';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div
        class="tenant-auth-screen flex min-h-screen flex-col justify-center px-4 pb-16 pt-10 sm:px-6"
    >
        <div class="mx-auto w-full max-w-[420px]">
            <TenantMark size="lg" class="mb-8" />
            <div class="tenant-card p-8 sm:p-9">
                <h1
                    class="text-center text-2xl font-bold tracking-tight text-slate-900"
                >
                    Reset password
                </h1>
                <p class="mt-2 text-center text-sm text-slate-600">
                    We will email a link when outbound mail is configured.
                </p>
                <form class="mt-8 space-y-5" @submit.prevent="submit">
                    <label class="block">
                        <span class="text-sm font-medium text-slate-800"
                            >Email</span
                        >
                        <input
                            v-model="email"
                            type="email"
                            required
                            autocomplete="email"
                            class="tenant-input mt-2"
                        />
                    </label>
                    <div
                        v-if="message"
                        class="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900"
                    >
                        {{ message }}
                    </div>
                    <div
                        v-if="error"
                        class="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                    >
                        {{ error }}
                    </div>
                    <button
                        type="submit"
                        class="tenant-btn-primary"
                        :disabled="loading"
                    >
                        {{ loading ? 'Sending…' : 'Send reset link' }}
                    </button>
                </form>
                <p class="mt-8 text-center text-sm text-slate-600">
                    <RouterLink
                        to="/login"
                        class="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-800"
                    >
                        Back to sign in
                    </RouterLink>
                </p>
            </div>
        </div>
    </div>
</template>
