<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import TenantMark from '../components/TenantMark.vue';

const router = useRouter();
const auth = useAuthStore();

const organizationId = ref('');
const fullName = ref('');
const phone = ref('');
const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);

const orgPreview = ref<{ id: string; name: string } | null>(null);
const orgPreviewError = ref<string | null>(null);

async function loadOrgPreview() {
    const id = organizationId.value.trim();
    if (!id) {
        orgPreview.value = null;
        orgPreviewError.value = null;
        return;
    }
    orgPreviewError.value = null;
    try {
        orgPreview.value = await api<{ id: string; name: string }>(
            `/tenant/organizations/preview?id=${encodeURIComponent(id)}`,
        );
    } catch (e) {
        orgPreview.value = null;
        orgPreviewError.value =
            e instanceof Error ? e.message : 'Organization not found';
    }
}

watch(organizationId, () => void loadOrgPreview());

const canSubmit = computed(
    () =>
        organizationId.value.trim().length > 0 &&
        fullName.value.trim().length >= 2 &&
        email.value.trim().length > 0 &&
        password.value.length >= 8,
);

async function submit() {
    loading.value = true;
    error.value = null;
    try {
        const body: Record<string, string> = {
            organizationId: organizationId.value.trim(),
            fullName: fullName.value.trim(),
            email: email.value.trim(),
            password: password.value,
        };
        const ph = phone.value.trim();
        if (ph) body.phone = ph;

        const res = await api<{
            access_token: string;
            refresh_token: string;
            renterId: string | null;
            accountStatus: 'active' | 'pending' | 'rejected';
        }>('/tenant/auth/register', {
            method: 'POST',
            body: JSON.stringify(body),
        });
        auth.setSession(
            res.access_token,
            res.refresh_token,
            res.renterId,
            res.accountStatus,
        );
        await router.replace('/');
    } catch (e) {
        error.value = e instanceof Error ? e.message : 'Registration failed';
    } finally {
        loading.value = false;
    }
}
</script>

<template>
    <div class="tenant-auth-screen min-h-screen px-4 pb-16 pt-10 sm:px-6">
        <div class="mx-auto w-full max-w-120">
            <TenantMark size="lg" class="mb-6" />

            <div class="tenant-card p-6 sm:p-8">
                <h1
                    class="text-center text-2xl font-bold tracking-tight text-slate-900"
                >
                    Create your access
                </h1>
                <p class="mt-2 text-center text-sm text-slate-600">
                    Enter the organization ID your landlord shared with you.
                </p>

                <form class="mt-8 space-y-4" @submit.prevent="submit">
                    <div>
                        <label class="block">
                            <span class="text-sm font-medium text-slate-700"
                                >Organization ID
                                <span class="text-red-500">*</span></span
                            >
                            <input
                                v-model="organizationId"
                                type="text"
                                required
                                autocomplete="off"
                                class="tenant-input mt-2 font-mono text-sm"
                                placeholder="Provided by your landlord"
                            />
                        </label>
                        <div
                            v-if="orgPreview"
                            class="mt-2 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
                        >
                            <span class="text-emerald-600">✓</span>
                            <span class="font-medium text-emerald-900">{{
                                orgPreview.name
                            }}</span>
                        </div>
                        <p
                            v-else-if="orgPreviewError"
                            class="mt-2 text-sm text-red-600"
                        >
                            {{ orgPreviewError }}
                        </p>
                    </div>

                    <label class="block">
                        <span class="text-sm font-medium text-slate-700"
                            >Full name
                            <span class="text-red-500">*</span></span
                        >
                        <input
                            v-model="fullName"
                            type="text"
                            required
                            minlength="2"
                            autocomplete="name"
                            class="tenant-input mt-2"
                        />
                    </label>

                    <label class="block">
                        <span class="text-sm font-medium text-slate-700"
                            >Phone
                            <span class="font-normal text-slate-400"
                                >(optional)</span
                            ></span
                        >
                        <input
                            v-model="phone"
                            type="tel"
                            autocomplete="tel"
                            class="tenant-input mt-2"
                        />
                    </label>

                    <label class="block">
                        <span class="text-sm font-medium text-slate-700"
                            >Email
                            <span class="text-red-500">*</span></span
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
                        <span class="text-sm font-medium text-slate-700"
                            >Password
                            <span class="text-red-500">*</span></span
                        >
                        <input
                            v-model="password"
                            type="password"
                            required
                            minlength="8"
                            autocomplete="new-password"
                            class="tenant-input mt-2"
                        />
                        <span class="mt-1 block text-xs text-slate-400"
                            >Minimum 8 characters</span
                        >
                    </label>

                    <p
                        v-if="error"
                        class="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-800"
                    >
                        {{ error }}
                    </p>

                    <button
                        type="submit"
                        class="tenant-btn-primary"
                        :disabled="loading || !canSubmit"
                    >
                        {{ loading ? 'Creating account…' : 'Create account' }}
                    </button>
                </form>

                <p class="mt-8 text-center text-sm text-slate-600">
                    Already have access?
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
