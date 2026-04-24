<script setup lang="ts">
import { RouterLink } from 'vue-router';
import SupportRequestsPanel from '../../components/SupportRequestsPanel.vue';
import { usePlatformOrgContext } from '../../composables/usePlatformOrgContext';

const { orgId } = usePlatformOrgContext();
</script>

<template>
    <div>
        <p class="mb-6 text-sm text-slate-600">
            Support tickets for this organization. For the full queue, open
            <RouterLink
                class="font-medium text-indigo-600 hover:underline"
                to="/support"
                >Support</RouterLink
            >
            from the top navigation.
        </p>
        <SupportRequestsPanel :scoped-organization-id="orgId" />
    </div>
</template>
