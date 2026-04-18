import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            meta: { public: true },
            component: () => import('../views/PlatformLoginView.vue'),
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            meta: { public: true },
            component: () => import('../views/PlatformForgotPasswordView.vue'),
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            meta: { public: true },
            component: () => import('../views/PlatformResetPasswordView.vue'),
        },
        {
            path: '/',
            component: () => import('../components/PlatformShell.vue'),
            meta: { requiresAuth: true },
            children: [
                {
                    path: '',
                    name: 'organizations',
                    component: () => import('../views/OrganizationsView.vue'),
                },
                {
                    path: 'support',
                    name: 'support-requests',
                    component: () => import('../views/SupportRequestsView.vue'),
                },
                {
                    path: 'organization/:orgId',
                    component: () => import('../layouts/PlatformOrgLayout.vue'),
                    children: [
                        {
                            path: '',
                            name: 'organization-detail',
                            component: () =>
                                import('../views/platform-org/PlatformOrgOverviewView.vue'),
                        },
                        {
                            path: 'team',
                            name: 'organization-team',
                            component: () =>
                                import('../views/platform-org/PlatformOrgTeamView.vue'),
                        },
                        {
                            path: 'properties',
                            name: 'organization-properties',
                            component: () =>
                                import('../views/platform-org/PlatformOrgPropertiesView.vue'),
                        },
                        {
                            path: 'properties/:propertyId/units',
                            name: 'organization-property-units',
                            component: () =>
                                import('../views/platform-org/PlatformOrgPropertyUnitsView.vue'),
                        },
                        {
                            path: 'renters',
                            name: 'organization-renters',
                            component: () =>
                                import('../views/platform-org/PlatformOrgRentersView.vue'),
                        },
                        {
                            path: 'leases',
                            name: 'organization-leases',
                            component: () =>
                                import('../views/platform-org/PlatformOrgLeasesView.vue'),
                        },
                        {
                            path: 'payments',
                            name: 'organization-payments',
                            component: () =>
                                import('../views/platform-org/PlatformOrgPaymentsView.vue'),
                        },
                        {
                            path: 'signups',
                            name: 'organization-signups',
                            component: () =>
                                import('../views/platform-org/PlatformOrgSignupsView.vue'),
                        },
                        {
                            path: 'audit-log',
                            name: 'organization-audit-log',
                            component: () =>
                                import('../views/platform-org/PlatformOrgAuditLogView.vue'),
                        },
                        {
                            path: 'support',
                            name: 'organization-support',
                            component: () =>
                                import('../views/platform-org/PlatformOrgSupportView.vue'),
                        },
                    ],
                },
            ],
        },
    ],
});

router.beforeEach((to) => {
    const auth = useAuthStore();
    const needsAuth = to.matched.some((r) => r.meta.requiresAuth);
    if (needsAuth && !auth.accessToken) {
        return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (
        to.meta.public &&
        auth.accessToken &&
        to.name !== 'reset-password'
    ) {
        return { path: '/' };
    }
    return true;
});

export default router;
