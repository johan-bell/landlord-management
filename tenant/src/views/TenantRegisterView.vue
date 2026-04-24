<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/auth';
import TenantMark from '../components/TenantMark.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

type RegMode = 'org' | 'claim' | 'invite';

const registrationMode = ref<RegMode>('org');

const inviteToken = ref('');
const renterId = ref('');
const organizationId = ref('');
const organizationSlug = ref('');
const fullName = ref('');
const phone = ref('');
const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const loading = ref(false);
const preview = ref<{ fullName: string; emailHint: string | null } | null>(
    null,
);
const previewError = ref<string | null>(null);
const orgPreview = ref<{
    id: string;
    name: string;
    slug: string | null;
} | null>(null);
const orgPreviewError = ref<string | null>(null);

async function loadInvitePreview() {
    const t = inviteToken.value.trim();
    if (!t) {
        preview.value = null;
        previewError.value = null;
        return;
    }
    previewError.value = null;
    try {
        preview.value = await api<{
            fullName: string;
            emailHint: string | null;
        }>(`/tenant/invites/preview?token=${encodeURIComponent(t)}`);
    } catch (e) {
        preview.value = null;
        previewError.value = e instanceof Error ? e.message : 'Invalid invite';
    }
}

async function loadOrgPreview() {
    const id = organizationId.value.trim();
    const slug = organizationSlug.value.trim();
    if (!id && !slug) {
        orgPreview.value = null;
        orgPreviewError.value = null;
        return;
    }
    orgPreviewError.value = null;
    try {
        const qs = id
            ? `id=${encodeURIComponent(id)}`
            : `slug=${encodeURIComponent(slug)}`;
        orgPreview.value = await api<{
            id: string;
            name: string;
            slug: string | null;
        }>(`/tenant/organizations/preview?${qs}`);
    } catch (e) {
        orgPreview.value = null;
        orgPreviewError.value =
            e instanceof Error ? e.message : 'Organization not found';
    }
}

const canSubmit = computed(() => {
    if (!email.value.trim() || password.value.length < 8) return false;
    if (registrationMode.value === 'invite') {
        return Boolean(inviteToken.value.trim());
    }
    if (registrationMode.value === 'claim') {
        return renterId.value.trim().length >= 10;
    }
    return Boolean(
        (organizationId.value.trim() || organizationSlug.value.trim()) &&
        fullName.value.trim().length >= 2,
    );
});

onMounted(() => {
    const q = route.query.token;
    if (typeof q === 'string' && q) {
        inviteToken.value = q;
        registrationMode.value = 'invite';
    }
    void loadInvitePreview();
});

watch(inviteToken, () => void loadInvitePreview());
watch([organizationId, organizationSlug], () => void loadOrgPreview());

async function submit() {
    loading.value = true;
    error.value = null;
    try {
        const body: Record<string, string> = {
            email: email.value.trim(),
            password: password.value,
        };
        if (registrationMode.value === 'invite') {
            body.inviteToken = inviteToken.value.trim();
        } else if (registrationMode.value === 'claim') {
            body.renterId = renterId.value.trim();
        } else {
            const id = organizationId.value.trim();
            const slug = organizationSlug.value.trim();
            if (id) body.organizationId = id;
            if (slug) body.organizationSlug = slug;
            body.fullName = fullName.value.trim();
            const ph = phone.value.trim();
            if (ph) body.phone = ph;
        }
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
        <div class="mx-auto w-full max-w-[480px]">
            <TenantMark size="lg" class="mb-6" />

            <div class="tenant-card p-6 sm:p-8">
                <h1
                    class="text-center text-2xl font-bold tracking-tight text-slate-900"
                >
                    Create your access
                </h1>
                <p class="mt-2 text-center text-sm text-slate-600">
                    Pick one path — your landlord may have told you which to
                    use.
                </p>

                <div
                    class="mb-8 grid grid-cols-1 gap-2 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-1.5 sm:grid-cols-3"
                    role="tablist"
                    aria-label="Registration type"
                >
                    <button
                        type="button"
                        role="tab"
                        :aria-selected="registrationMode === 'org'"
                        class="rounded-xl px-3 py-2.5 text-center text-xs font-semibold transition sm:text-sm"
                        :class="
                            registrationMode === 'org'
                                ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/80'
                                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                        "
                        @click="registrationMode = 'org'"
                    >
                        New signup
                    </button>
                    <button
                        type="button"
                        role="tab"
                        :aria-selected="registrationMode === 'claim'"
                        class="rounded-xl px-3 py-2.5 text-center text-xs font-semibold transition sm:text-sm"
                        :class="
                            registrationMode === 'claim'
                                ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/80'
                                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                        "
                        @click="registrationMode = 'claim'"
                    >
                        Renter ID
                    </button>
                    <button
                        type="button"
                        role="tab"
                        :aria-selected="registrationMode === 'invite'"
                        class="rounded-xl px-3 py-2.5 text-center text-xs font-semibold transition sm:text-sm"
                        :class="
                            registrationMode === 'invite'
                                ? 'bg-white text-slate-900 shadow-md shadow-slate-200/50 ring-1 ring-slate-200/80'
                                : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                        "
                        @click="registrationMode = 'invite'"
                    >
                        Invite link
                    </button>
                </div>

                <p
                    v-if="registrationMode === 'org'"
                    class="mb-5 rounded-2xl border border-teal-100/80 bg-teal-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700"
                >
                    Enter the
                    <strong class="text-slate-900">organization ID</strong> or
                    <strong class="text-slate-900">slug</strong> from your
                    landlord. After you register, they assign your unit and
                    approve access.
                </p>
                <p
                    v-else-if="registrationMode === 'claim'"
                    class="mb-5 rounded-2xl border border-sky-100/80 bg-sky-50/50 px-4 py-3 text-sm leading-relaxed text-slate-700"
                >
                    Your landlord created a profile for you. Use the renter ID
                    they shared —
                    <strong class="text-slate-900"
                        >your email must match</strong
                    >
                    that profile.
                </p>
                <p
                    v-else
                    class="mb-5 rounded-2xl border border-violet-100/80 bg-violet-50/40 px-4 py-3 text-sm leading-relaxed text-slate-700"
                >
                    Paste the token from the invite link your landlord sent (or
                    open the link on this device first).
                </p>

                <div
                    v-if="preview && registrationMode === 'invite'"
                    class="mb-4 rounded-2xl border border-teal-200/60 bg-linear-to-br from-teal-50 to-emerald-50/80 px-4 py-3 text-left text-sm text-slate-700 shadow-sm"
                >
                    <p class="font-medium text-slate-900">
                        {{ preview.fullName }}
                    </p>
                    <p
                        v-if="preview.emailHint"
                        class="mt-1 text-xs text-slate-600"
                    >
                        Email hint: {{ preview.emailHint }}
                    </p>
                </div>
                <p
                    v-else-if="previewError && registrationMode === 'invite'"
                    class="mb-4 text-sm text-amber-800"
                >
                    {{ previewError }}
                </p>

                <div
                    v-if="orgPreview && registrationMode === 'org'"
                    class="mb-4 rounded-2xl border border-emerald-200/60 bg-linear-to-br from-emerald-50 to-teal-50/60 px-4 py-3 text-left text-sm text-slate-700 shadow-sm"
                >
                    <p class="font-medium text-slate-900">
                        {{ orgPreview.name }}
                    </p>
                    <p class="mt-1 font-mono text-xs text-slate-600">
                        ID: {{ orgPreview.id }}
                    </p>
                </div>
                <p
                    v-else-if="orgPreviewError && registrationMode === 'org'"
                    class="mb-4 text-sm text-amber-800"
                >
                    {{ orgPreviewError }}
                </p>

                <form class="space-y-4" @submit.prevent="submit">
                    <template v-if="registrationMode === 'org'">
                        <label class="block">
                            <span class="text-sm font-medium text-slate-700"
                                >Organization ID</span
                            >
                            <input
                                v-model="organizationId"
                                type="text"
                                autocomplete="off"
                                class="tenant-input mt-2 font-mono text-sm"
                                placeholder="e.g. seed_org_douala"
                            />
                        </label>
                        <p class="text-center text-xs text-slate-400">— or —</p>
                        <label class="block">
                            <span class="text-sm font-medium text-slate-700"
                                >Organization slug</span
                            >
                            <input
                                v-model="organizationSlug"
                                type="text"
                                autocomplete="off"
                                class="tenant-input mt-2 text-sm"
                                placeholder="e.g. douala-rentals-demo"
                            />
                        </label>
                        <label class="block">
                            <span class="text-sm font-medium text-slate-700"
                                >Your full name</span
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
                    </template>

                    <label v-if="registrationMode === 'claim'" class="block">
                        <span class="text-sm font-medium text-slate-700"
                            >Renter ID</span
                        >
                        <input
                            v-model="renterId"
                            type="text"
                            minlength="10"
                            autocomplete="off"
                            class="tenant-input mt-2 font-mono text-sm"
                            placeholder="From your landlord"
                        />
                    </label>
                    <label v-if="registrationMode === 'invite'" class="block">
                        <span class="text-sm font-medium text-slate-700"
                            >Invite token</span
                        >
                        <input
                            v-model="inviteToken"
                            type="text"
                            autocomplete="off"
                            class="tenant-input mt-2 font-mono text-xs"
                            placeholder="Pasted from invite link"
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
                            autocomplete="email"
                            class="tenant-input mt-2"
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
                            minlength="8"
                            autocomplete="new-password"
                            class="tenant-input mt-2"
                        />
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
