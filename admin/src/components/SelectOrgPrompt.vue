<script setup lang="ts">
import { BuildingOffice2Icon } from '@heroicons/vue/24/outline';
import { RouterLink } from 'vue-router';
</script>

<template>
    <div
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm"
    >
        <div
            class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
        >
            <BuildingOffice2Icon class="h-7 w-7" aria-hidden="true" />
        </div>
        <h2 class="text-lg font-semibold text-slate-900">
            Choose an organization
        </h2>
        <p class="mt-2 max-w-sm text-sm text-slate-600">
            Use the organization menu in the header to select your portfolio.
            You can create a new one from
            <RouterLink
                to="/"
                class="font-medium text-emerald-600 hover:text-emerald-700"
                >Overview</RouterLink
            >.
        </p>
    </div>
</template>
