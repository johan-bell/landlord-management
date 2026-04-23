<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
    icon?: Component;
    title: string;
    description?: string;
    actionLabel?: string;
}>();

const emit = defineEmits<{ action: [] }>();
</script>

<template>
    <div
        class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-16 text-center"
    >
        <div
            v-if="icon"
            class="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
        >
            <component :is="icon" class="h-7 w-7" aria-hidden="true" />
        </div>
        <p class="text-sm font-semibold text-slate-700">{{ title }}</p>
        <p
            v-if="description"
            class="mt-1.5 max-w-xs text-xs leading-relaxed text-slate-500"
        >
            {{ description }}
        </p>
        <button
            v-if="actionLabel"
            type="button"
            class="mt-5 inline-flex items-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            @click="emit('action')"
        >
            {{ actionLabel }}
        </button>
        <slot />
    </div>
</template>
