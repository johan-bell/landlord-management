<script setup lang="ts">
import type { Component } from 'vue';
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import {
    Bars3Icon,
    BuildingOffice2Icon,
    ChevronDoubleLeftIcon,
    ChevronDoubleRightIcon,
    ClipboardDocumentCheckIcon,
    ClipboardDocumentListIcon,
    ClockIcon,
    DocumentTextIcon,
    LifebuoyIcon,
    Squares2X2Icon,
    UserGroupIcon,
    UsersIcon,
    WalletIcon,
} from '@heroicons/vue/24/outline';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useOrgStore } from '../stores/org';
import AdminHeaderProfileMenu from '../components/AdminHeaderProfileMenu.vue';
import ToastNotifications from '../components/ToastNotifications.vue';
import { setAdminLocale } from '../i18n';
import { orgRoleHint, orgRoleLabel } from '../lib/orgRoles';

const NAV_ICON_COMPONENTS: Record<
    | 'grid'
    | 'building'
    | 'users'
    | 'clock'
    | 'file'
    | 'wallet'
    | 'receipt'
    | 'team'
    | 'audit'
    | 'support',
    Component
> = {
    grid: Squares2X2Icon,
    building: BuildingOffice2Icon,
    users: UsersIcon,
    clock: ClockIcon,
    file: DocumentTextIcon,
    wallet: WalletIcon,
    receipt: ClipboardDocumentCheckIcon,
    team: UserGroupIcon,
    audit: ClipboardDocumentListIcon,
    support: LifebuoyIcon,
};

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const orgStore = useOrgStore();
const {
    organizations: orgs,
    organizationsLoading: loadingOrgs,
    selectedOrgId,
    selectedOrgMyRole,
} = storeToRefs(orgStore);

const mobileNavOpen = ref(false);
const sidebarCollapsed = ref(
    localStorage.getItem('lm_sidebar_collapsed') === 'true',
);

const pageTitle = computed(() => (route.meta.title as string) ?? 'Admin');

const userLabel = computed(() => auth.user?.email ?? 'Signed in');

const selectedOrgName = computed(() => {
    const id = selectedOrgId.value;
    if (!id) return null;
    return orgs.value.find((o) => o.id === id)?.name ?? null;
});

const profileInitials = computed(() => {
    const name = auth.user?.name?.trim();
    if (name) {
        const parts = name.split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (
            parts[0][0] + parts[parts.length - 1][0]
        ).toUpperCase();
    }
    const email = auth.user?.email ?? '';
    const local = email.split('@')[0] || email;
    return local.slice(0, 2).toUpperCase() || '?';
});

const profileMenuLabel = computed(() => {
    const e = auth.user?.email;
    return e ? `Account menu for ${e}` : 'Account menu';
});

const orgRoleLabelComputed = computed(() =>
    orgRoleLabel(selectedOrgMyRole.value),
);

const orgRoleHintComputed = computed(() =>
    orgRoleHint(selectedOrgMyRole.value),
);

function logout() {
    auth.clearSession();
    void router.push({ name: 'login' });
}

const nav = computed(() => {
    const role = selectedOrgMyRole.value;
    const isElevated = role === 'OWNER' || role === 'MANAGER';

    const items: {
        to: string;
        label: string;
        icon: keyof typeof NAV_ICON_COMPONENTS;
    }[] = [
        { to: '/', label: t('nav.overview'), icon: 'grid' },
        { to: '/properties', label: t('nav.properties'), icon: 'building' },
        { to: '/renters', label: t('nav.renters'), icon: 'users' },
        { to: '/tenant-signups', label: t('nav.tenantSignups'), icon: 'clock' },
        { to: '/leases', label: t('nav.leases'), icon: 'file' },
        { to: '/payments', label: t('nav.payments'), icon: 'wallet' },
        { to: '/receipts', label: t('nav.receipts'), icon: 'receipt' },
    ];

    if (isElevated) {
        items.push({ to: '/team', label: t('nav.team'), icon: 'team' });
        items.push({ to: '/audit-log', label: t('nav.auditLog'), icon: 'audit' });
    }

    items.push({ to: '/support', label: t('nav.support'), icon: 'support' });
    return items;
});

function onLocaleChange(ev: Event) {
    const v = (ev.target as HTMLSelectElement).value;
    if (v === 'fr' || v === 'en') {
        setAdminLocale(v);
    }
}

function closeMobileNav() {
    mobileNavOpen.value = false;
}

function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem(
        'lm_sidebar_collapsed',
        String(sidebarCollapsed.value),
    );
}

watch(
    () => route.fullPath,
    () => {
        closeMobileNav();
    },
);

onMounted(() => {
    void orgStore.fetchOrganizations();
});
</script>

<template>
    <div class="min-h-screen bg-transparent font-sans text-slate-900">
        <div
            v-if="mobileNavOpen"
            class="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
            aria-hidden="true"
            @click="closeMobileNav"
        />

        <aside
            :class="[
                'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-linear-to-b from-slate-900 via-slate-900 to-slate-950 shadow-xl transition-all duration-200 lg:translate-x-0',
                sidebarCollapsed ? 'w-16' : 'w-72',
                mobileNavOpen
                    ? 'translate-x-0'
                    : '-translate-x-full lg:translate-x-0',
            ]"
        >
            <div
                class="flex h-16 items-center gap-3 border-b border-white/10 px-4"
                :class="sidebarCollapsed ? 'justify-center' : 'px-5'"
            >
                <div
                    class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-emerald-400 to-teal-600 text-lg font-bold text-white shadow-lg shadow-emerald-900/40"
                >
                    LM
                </div>
                <Transition
                    enter-active-class="transition duration-150 ease-out"
                    enter-from-class="opacity-0 -translate-x-2"
                    enter-to-class="opacity-100 translate-x-0"
                    leave-active-class="transition duration-100 ease-in"
                    leave-from-class="opacity-100"
                    leave-to-class="opacity-0"
                >
                    <div v-if="!sidebarCollapsed">
                        <p
                            class="text-xs font-medium uppercase tracking-wider text-slate-400"
                        >
                            Console
                        </p>
                        <p class="text-sm font-semibold text-white">
                            Landlord Admin
                        </p>
                    </div>
                </Transition>
            </div>

            <nav
                class="flex-1 space-y-1 overflow-y-auto py-4"
                :class="sidebarCollapsed ? 'px-2' : 'px-3'"
            >
                <RouterLink
                    v-for="item in nav"
                    :key="item.to"
                    :to="item.to"
                    end
                    class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 transition duration-150 hover:bg-white/5 hover:text-white"
                    active-class="!bg-white/10 !text-white shadow-inner ring-1 ring-white/10"
                    :title="sidebarCollapsed ? item.label : undefined"
                    :class="sidebarCollapsed ? 'justify-center px-2' : ''"
                >
                    <span
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-400 group-[.router-link-active]:bg-emerald-500/20 group-[.router-link-active]:text-emerald-400"
                    >
                        <component
                            :is="NAV_ICON_COMPONENTS[item.icon] ?? WalletIcon"
                            class="h-5 w-5"
                            aria-hidden="true"
                        />
                    </span>
                    <span v-if="!sidebarCollapsed">{{ item.label }}</span>
                </RouterLink>
            </nav>

            <div
                class="border-t border-white/10 p-4"
                :class="sidebarCollapsed ? 'px-2' : ''"
            >
                <template v-if="!sidebarCollapsed">
                    <label class="mb-2 block text-xs text-slate-500">
                        Language
                        <select
                            class="mt-1 w-full rounded-lg border border-white/10 bg-slate-800/80 px-2 py-1.5 text-sm text-white"
                            :value="locale"
                            @change="onLocaleChange"
                        >
                            <option value="en">{{ t('locale.en') }}</option>
                            <option value="fr">{{ t('locale.fr') }}</option>
                        </select>
                    </label>
                    <p class="text-xs text-slate-500">
                        Property & rent operations
                    </p>
                    <p class="mt-1 text-xs text-slate-400">v0.1 · local dev</p>
                </template>
                <button
                    type="button"
                    class="mt-3 flex w-full items-center justify-center rounded-lg py-2 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                    :aria-label="
                        sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                    "
                    @click="toggleSidebar"
                >
                    <ChevronDoubleLeftIcon
                        v-if="!sidebarCollapsed"
                        class="h-4 w-4"
                        aria-hidden="true"
                    />
                    <ChevronDoubleRightIcon
                        v-else
                        class="h-4 w-4"
                        aria-hidden="true"
                    />
                </button>
            </div>
        </aside>

        <div
            :class="[
                'transition-all duration-200',
                sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-72',
            ]"
        >
            <header
                class="sticky top-0 z-30 flex min-h-16 flex-col gap-3 border-b border-slate-200/70 bg-white/85 px-4 py-3 shadow-sm shadow-slate-200/30 backdrop-blur-lg sm:flex-row sm:items-center sm:justify-between sm:px-6"
            >
                <div class="flex min-w-0 flex-1 items-center gap-3">
                    <button
                        type="button"
                        class="inline-flex shrink-0 rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
                        aria-label="Open menu"
                        @click="mobileNavOpen = true"
                    >
                        <Bars3Icon class="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div class="min-w-0">
                        <h1
                            class="truncate text-lg font-semibold text-slate-900"
                        >
                            {{ pageTitle }}
                        </h1>
                        <p class="hidden text-xs text-slate-500 sm:block">
                            Portfolio, renters & rent collection
                        </p>
                    </div>
                </div>

                <div
                    class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end sm:gap-3"
                >
                    <label class="block min-w-0 flex-1 sm:max-w-xs sm:flex-none">
                        <span class="sr-only">Organization</span>
                        <select
                            :value="selectedOrgId ?? ''"
                            class="box-border h-10 w-full min-w-0 cursor-pointer rounded-xl border border-slate-200 bg-white py-0 pl-3 pr-8 text-sm font-medium leading-5 text-slate-800 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            :disabled="loadingOrgs"
                            @change="
                                orgStore.setOrg(
                                    ($event.target as HTMLSelectElement)
                                        .value || null,
                                )
                            "
                        >
                            <option value="" disabled>
                                {{
                                    loadingOrgs
                                        ? 'Loading…'
                                        : 'Select organization'
                                }}
                            </option>
                            <option
                                v-for="o in orgs"
                                :key="o.id"
                                :value="o.id"
                            >
                                {{ o.name }}
                            </option>
                        </select>
                    </label>
                    <AdminHeaderProfileMenu
                        :initials="profileInitials"
                        :menu-label="profileMenuLabel"
                        :email="userLabel"
                        :org-name="selectedOrgName"
                        :org-role-label="orgRoleLabelComputed"
                        :org-role-hint="orgRoleHintComputed"
                        :is-platform-admin="!!auth.user?.isPlatformAdmin"
                        @sign-out="logout"
                    />
                </div>
            </header>

            <main class="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
                <RouterView v-slot="{ Component: RoutedComponent }">
                    <Transition name="fade" mode="out-in">
                        <component
                            :is="RoutedComponent"
                            :key="selectedOrgId ?? '__no_org__'"
                        />
                    </Transition>
                </RouterView>
            </main>
        </div>
    </div>

    <ToastNotifications />
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.12s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
