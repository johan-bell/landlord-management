<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import { setTenantLocale } from '../i18n';
import TenantMark from '../components/TenantMark.vue';

const { t, locale } = useI18n();

function onLocaleChange(ev: Event) {
    const v = (ev.target as HTMLSelectElement).value;
    if (v === 'fr' || v === 'en') {
        setTenantLocale(v);
    }
}

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
        const res = await api<{
            access_token: string;
            refresh_token: string;
            renterId: string | null;
            accountStatus: 'active' | 'pending' | 'rejected';
        }>('/tenant/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: email.value.trim(),
                password: password.value,
            }),
        });
        auth.setSession(
            res.access_token,
            res.refresh_token,
            res.renterId,
            res.accountStatus,
        );
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
    <div
        class="tenant-auth-screen flex min-h-screen flex-col justify-center px-4 pb-16 pt-10 sm:px-6"
    >
        <div class="mx-auto w-full max-w-[420px]">
            <TenantMark size="lg" class="mb-8" />

            <div class="tenant-card p-8 sm:p-9">
                <div class="mb-4 flex justify-end">
                    <label class="text-xs text-slate-500">
                        <span class="sr-only">Language</span>
                        <select
                            class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                            :value="locale"
                            @change="onLocaleChange"
                        >
                            <option value="en">{{ t('locale.en') }}</option>
                            <option value="fr">{{ t('locale.fr') }}</option>
                        </select>
                    </label>
                </div>
                <h1
                    class="text-center text-2xl font-bold tracking-tight text-slate-900"
                >
                    {{ t('login.title') }}
                </h1>
                <p
                    class="mt-2 text-center text-sm leading-relaxed text-slate-600"
                >
                    {{ t('login.subtitle') }}
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
                    <label class="block">
                        <span class="text-sm font-medium text-slate-800"
                            >Password</span
                        >
                        <input
                            v-model="password"
                            type="password"
                            required
                            autocomplete="current-password"
                            class="tenant-input mt-2"
                        />
                    </label>

                    <div
                        v-if="error"
                        class="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                        role="alert"
                    >
                        {{ error }}
                    </div>

                    <button
                        type="submit"
                        class="tenant-btn-primary"
                        :disabled="loading"
                    >
                        {{ loading ? 'Signing in…' : 'Sign in' }}
                    </button>
                </form>

                <p class="mt-4 text-center text-sm">
                    <RouterLink
                        to="/forgot-password"
                        class="font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
                    >
                        Forgot password?
                    </RouterLink>
                </p>

                <p class="mt-8 text-center text-sm text-slate-600">
                    First time here?
                    <RouterLink
                        to="/register"
                        class="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-2 hover:text-teal-800"
                    >
                        Create your account
                    </RouterLink>
                </p>
            </div>
        </div>
    </div>
</template>
