<script setup lang="ts">
import SupportRequestsPanel from '../components/SupportRequestsPanel.vue';
</script>

<template>
    <div>
        <div class="mb-8">
            <h1 class="text-2xl font-bold tracking-tight text-slate-900">
                Support requests
            </h1>
            <p class="mt-1 text-sm text-slate-600">
                Tenant and landlord-originated tickets. Open a row to update
                status. The resolution note is shown to renters when the ticket
                is resolved or closed.
            </p>
        </div>
        <SupportRequestsPanel />
    </div>
</template>
