import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/login',
            name: 'login',
            meta: { public: true },
            component: () => import('../views/TenantLoginView.vue'),
        },
        {
            path: '/register',
            name: 'register',
            meta: { public: true },
            component: () => import('../views/TenantRegisterView.vue'),
        },
        {
            path: '/forgot-password',
            name: 'forgot-password',
            meta: { public: true },
            component: () => import('../views/TenantForgotPasswordView.vue'),
        },
        {
            path: '/reset-password',
            name: 'reset-password',
            meta: { public: true },
            component: () => import('../views/TenantResetPasswordView.vue'),
        },
        {
            path: '/',
            name: 'home',
            meta: { requiresAuth: true },
            component: () => import('../views/TenantHomeView.vue'),
        },
    ],
});

router.beforeEach((to) => {
    const auth = useAuthStore();
    const needsAuth = to.matched.some((r) => r.meta.requiresAuth);
    if (needsAuth && !auth.accessToken) {
        return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (to.meta.public && auth.accessToken && to.name !== 'reset-password') {
        return { path: '/' };
    }
    return true;
});

export default router;
