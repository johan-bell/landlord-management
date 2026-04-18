<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import TenantMark from '../components/TenantMark.vue';

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
        await api('/tenant/auth/reset-password', {
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
    <div
        class="tenant-auth-screen flex min-h-screen flex-col justify-center px-4 pb-16 pt-10 sm:px-6"
    >
        <div class="mx-auto w-full max-w-[420px]">
            <TenantMark size="lg" class="mb-8" />
            <div class="tenant-card p-8 sm:p-9">
                <h1
                    class="text-center text-2xl font-bold tracking-tight text-slate-900"
                >
                    New password
                </h1>
                <form class="mt-8 space-y-5" @submit.prevent="submit">
                    <label class="block">
                        <span class="text-sm font-medium text-slate-800"
                            >Reset token</span
                        >
                        <input
                            v-model="token"
                            type="text"
                            required
                            class="tenant-input mt-2 font-mono text-sm"
                        />
                    </label>
                    <label class="block">
                        <span class="text-sm font-medium text-slate-800"
                            >Password (min 8)</span
                        >
                        <input
                            v-model="password"
                            type="password"
                            required
                            minlength="8"
                            autocomplete="new-password"
                            class="tenant-input mt-2"
                        />
                    </label>
                    <div
                        v-if="error"
                        class="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                    >
                        {{ error }}
                    </div>
                    <button
                        type="submit"
                        class="tenant-btn-primary"
                        :disabled="loading || !token.trim()"
                    >
                        {{ loading ? 'Saving…' : 'Save password' }}
                    </button>
                </form>
                <p class="mt-8 text-center text-sm text-slate-600">
                    <RouterLink
                        to="/login"
                        class="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-800"
                    >
                        Sign in
                    </RouterLink>
                </p>
            </div>
        </div>
    </div>
</template>
