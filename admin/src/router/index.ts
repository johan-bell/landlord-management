import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      meta: { public: true },
      component: () => import('../views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      meta: { public: true },
      component: () => import('../views/RegisterView.vue'),
    },
    {
      path: '/invite',
      name: 'invite',
      meta: { public: true },
      component: () => import('../views/InviteAcceptView.vue'),
    },
    {
      path: '/',
      component: () => import('../layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          meta: { title: 'Overview' },
          component: () => import('../views/DashboardView.vue'),
        },
        {
          path: 'properties',
          name: 'properties',
          meta: { title: 'Properties' },
          component: () => import('../views/PropertiesView.vue'),
        },
        {
          path: 'properties/:propertyId/units',
          name: 'property-units',
          meta: { title: 'Property units' },
          component: () => import('../views/PropertyUnitsView.vue'),
        },
        {
          path: 'renters',
          name: 'renters',
          meta: { title: 'Renters' },
          component: () => import('../views/RentersView.vue'),
        },
        {
          path: 'leases',
          name: 'leases',
          meta: { title: 'Leases' },
          component: () => import('../views/LeasesView.vue'),
        },
        {
          path: 'payments',
          name: 'payments',
          meta: { title: 'Payments' },
          component: () => import('../views/PaymentsView.vue'),
        },
        {
          path: 'team',
          name: 'team',
          meta: { title: 'Team' },
          component: () => import('../views/TeamView.vue'),
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
  if (to.meta.public && auth.accessToken && to.name !== 'invite') {
    return { path: '/' };
  }
  return true;
});

export default router;
