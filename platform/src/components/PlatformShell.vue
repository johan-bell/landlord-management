<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { setPlatformLocale } from '../i18n';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

function onLocaleChange(ev: Event) {
    const v = (ev.target as HTMLSelectElement).value;
    if (v === 'fr' || v === 'en') {
        setPlatformLocale(v);
    }
}

function logout() {
    auth.clearSession();
    void router.push('/login');
}

function navClass(kind: 'orgs' | 'support') {
    const active =
        kind === 'orgs'
            ? route.path === '/' ||
              route.path === '' ||
              route.path.startsWith('/organization/')
            : route.path === '/support';
    return [
        'rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
        active
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/25'
            : 'text-slate-600 hover:bg-white/80 hover:text-slate-900',
    ];
}
</script>

<template>
    <div class="min-h-screen">
        <header
            class="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-md sm:px-8"
        >
            <div
                class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3"
            >
                <div class="flex min-w-0 flex-wrap items-center gap-4 sm:gap-8">
                    <RouterLink
                        to="/"
                        class="flex shrink-0 items-center gap-2.5"
                    >
                        <div
                            class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/20"
                        >
                            LM
                        </div>
                        <div class="hidden min-w-0 sm:block">
                            <p
                                class="text-sm font-semibold leading-tight text-slate-900"
                            >
                                Platform
                            </p>
                            <p class="text-xs text-slate-500">
                                Operator console
                            </p>
                        </div>
                    </RouterLink>

                    <nav
                        class="flex flex-wrap items-center gap-1.5 sm:gap-2"
                        aria-label="Main"
                    >
                        <RouterLink :class="navClass('orgs')" to="/">{{
                            t('nav.organizations')
                        }}</RouterLink>
                        <RouterLink :class="navClass('support')" to="/support">{{
                            t('nav.support')
                        }}</RouterLink>
                    </nav>
                </div>

                <div class="flex items-center gap-2 sm:gap-3">
                    <label class="hidden text-xs text-slate-500 sm:flex sm:items-center sm:gap-1">
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
                    <span
                        v-if="auth.user"
                        class="hidden max-w-[200px] truncate text-sm text-slate-600 md:inline"
                    >
                        {{ auth.user.email }}
                    </span>
                    <button
                        type="button"
                        class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        @click="logout"
                    >
                        {{ t('actions.signOut') }}
                    </button>
                </div>
            </div>
        </header>

        <main class="mx-auto max-w-6xl px-4 py-8 sm:px-8">
            <RouterView />
        </main>
    </div>
</template>
