<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
    <div
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm"
    >
        <div
            class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"
        >
            <svg
                class="h-7 w-7"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="1.5"
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
            </svg>
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
