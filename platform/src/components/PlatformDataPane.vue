<script setup lang="ts">
defineProps<{
    loading: boolean;
    error: string | null;
    empty?: boolean;
    emptyMessage?: string;
}>();

defineEmits<{
    retry: [];
}>();
</script>

<template>
    <div>
        <slot name="filters" />

        <div
            v-if="loading"
            class="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-600 shadow-sm"
        >
            Loading…
        </div>

        <p
            v-else-if="error"
            class="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
            {{ error }}
            <button
                type="button"
                class="ml-2 font-semibold text-red-900 underline hover:no-underline"
                @click="$emit('retry')"
            >
                Retry
            </button>
        </p>

        <p
            v-else-if="empty"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm"
        >
            {{ emptyMessage ?? 'Nothing to show.' }}
        </p>

        <slot v-else />
    </div>
</template>
