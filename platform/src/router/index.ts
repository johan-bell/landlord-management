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
      path: '/',
      name: 'organizations',
      meta: { requiresAuth: true },
      component: () => import('../views/OrganizationsView.vue'),
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  const needsAuth = to.matched.some((r) => r.meta.requiresAuth);
  if (needsAuth && !auth.accessToken) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.public && auth.accessToken) {
    return { path: '/' };
  }
  return true;
});

export default router;
