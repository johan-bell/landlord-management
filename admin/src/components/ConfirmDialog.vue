<script setup lang="ts">
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline';

defineProps<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
    confirm: [];
}>();
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="duration-150 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="duration-100 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="open"
                class="fixed inset-0 z-50 flex items-center justify-center p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-dialog-title"
            >
                <div
                    class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    @click="emit('update:open', false)"
                />
                <Transition
                    enter-active-class="duration-150 ease-out"
                    enter-from-class="opacity-0 scale-95"
                    enter-to-class="opacity-100 scale-100"
                    leave-active-class="duration-100 ease-in"
                    leave-from-class="opacity-100 scale-100"
                    leave-to-class="opacity-0 scale-95"
                    appear
                >
                    <div
                        v-if="open"
                        class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-200/60"
                    >
                        <div class="flex items-start gap-4">
                            <div
                                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                                :class="
                                    danger
                                        ? 'bg-red-100 text-red-600'
                                        : 'bg-amber-100 text-amber-600'
                                "
                            >
                                <ExclamationTriangleIcon
                                    class="h-5 w-5"
                                    aria-hidden="true"
                                />
                            </div>
                            <div class="min-w-0 flex-1">
                                <h3
                                    id="confirm-dialog-title"
                                    class="text-base font-semibold text-slate-900"
                                >
                                    {{ title }}
                                </h3>
                                <p
                                    class="mt-1.5 text-sm leading-relaxed text-slate-600"
                                >
                                    {{ message }}
                                </p>
                            </div>
                        </div>
                        <div class="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                class="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                                @click="emit('update:open', false)"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                class="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
                                :class="
                                    danger
                                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                                        : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500'
                                "
                                @click="emit('confirm')"
                            >
                                {{ confirmLabel ?? 'Confirm' }}
                            </button>
                        </div>
                    </div>
                </Transition>
            </div>
        </Transition>
    </Teleport>
</template>
