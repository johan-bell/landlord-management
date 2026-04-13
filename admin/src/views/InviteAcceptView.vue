<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const token = computed(() => (route.query.token as string) || '');

const preview = ref<{
    organizationName: string;
    email: string;
    role: string;
} | null>(null);
const loadError = ref<string | null>(null);
const loading = ref(true);
const acceptError = ref<string | null>(null);
const accepting = ref(false);

async function loadPreview() {
    if (!token.value) {
        loadError.value = 'Missing invitation token in the URL.';
        loading.value = false;
        return;
    }
    loading.value = true;
    loadError.value = null;
    try {
        preview.value = await api<{
            organizationName: string;
            email: string;
            role: string;
        }>(
            `/invitations/organization?token=${encodeURIComponent(token.value)}`,
        );
    } catch (e) {
        loadError.value = e instanceof Error ? e.message : 'Invalid invitation';
        preview.value = null;
    } finally {
        loading.value = false;
    }
}

async function accept() {
    if (!token.value || !auth.accessToken) return;
    accepting.value = true;
    acceptError.value = null;
    try {
        await api('/invitations/organization/accept', {
            method: 'POST',
            body: JSON.stringify({ token: token.value }),
        });
        await router.replace('/');
    } catch (e) {
        acceptError.value = e instanceof Error ? e.message : 'Could not accept';
    } finally {
        accepting.value = false;
    }
}

onMounted(() => void loadPreview());
</script>

<template>
    <div class="flex min-h-screen flex-col justify-center px-4 py-10">
        <div
            class="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
            <h1 class="text-xl font-semibold text-slate-900">
                Organization invite
            </h1>

            <div v-if="loading" class="mt-6 text-sm text-slate-500">
                Checking invitation…
            </div>

            <p v-else-if="loadError" class="mt-4 text-sm text-red-600">
                {{ loadError }}
            </p>

            <template v-else-if="preview">
                <p class="mt-4 text-sm text-slate-600">
                    You’ve been invited to join
                    <span class="font-semibold text-slate-900">{{
                        preview.organizationName
                    }}</span>
                    as
                    <span class="font-medium">{{ preview.role }}</span
                    >. The invite is for
                    <span class="font-mono text-xs">{{ preview.email }}</span
                    >.
                </p>

                <p v-if="acceptError" class="mt-4 text-sm text-red-600">
                    {{ acceptError }}
                </p>

                <div v-if="!auth.accessToken" class="mt-6 space-y-3">
                    <p class="text-sm text-slate-600">
                        Sign in or register with
                        <strong>{{ preview.email }}</strong
                        >, then return here to accept.
                    </p>
                    <RouterLink
                        class="block w-full rounded-xl bg-slate-900 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
                        :to="{
                            name: 'login',
                            query: { redirect: route.fullPath },
                        }"
                    >
                        Sign in
                    </RouterLink>
                    <RouterLink
                        class="block w-full rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        :to="{
                            name: 'register',
                            query: { redirect: route.fullPath },
                        }"
                    >
                        Create account
                    </RouterLink>
                </div>

                <button
                    v-else
                    type="button"
                    class="mt-6 w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    :disabled="accepting"
                    @click="accept"
                >
                    {{ accepting ? 'Joining…' : 'Accept & join organization' }}
                </button>
            </template>
        </div>
    </div>
</template>
