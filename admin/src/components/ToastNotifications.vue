<script setup lang="ts">
import { TransitionGroup } from 'vue';
import {
    CheckCircleIcon,
    ExclamationCircleIcon,
    InformationCircleIcon,
    XCircleIcon,
    XMarkIcon,
} from '@heroicons/vue/24/solid';
import { useToastStore } from '../stores/toast';
import type { Toast } from '../stores/toast';

const toast = useToastStore();

function iconFor(kind: Toast['kind']) {
    if (kind === 'success') return CheckCircleIcon;
    if (kind === 'error') return XCircleIcon;
    if (kind === 'warning') return ExclamationCircleIcon;
    return InformationCircleIcon;
}

function colorFor(kind: Toast['kind']) {
    if (kind === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-900';
    if (kind === 'error') return 'border-red-200 bg-red-50 text-red-900';
    if (kind === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
    return 'border-blue-200 bg-blue-50 text-blue-900';
}

function iconColorFor(kind: Toast['kind']) {
    if (kind === 'success') return 'text-emerald-500';
    if (kind === 'error') return 'text-red-500';
    if (kind === 'warning') return 'text-amber-500';
    return 'text-blue-500';
}
</script>

<template>
    <Teleport to="body">
        <div
            aria-live="polite"
            aria-atomic="false"
            class="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-end gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-sm"
        >
            <TransitionGroup
                enter-active-class="transition duration-200 ease-out"
                enter-from-class="translate-y-2 opacity-0 sm:translate-y-0 sm:translate-x-2"
                enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
                leave-active-class="transition duration-150 ease-in"
                leave-from-class="translate-y-0 opacity-100"
                leave-to-class="translate-y-2 opacity-0"
                move-class="transition duration-200"
            >
                <div
                    v-for="t in toast.toasts"
                    :key="t.id"
                    class="pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 shadow-lg shadow-slate-200/60"
                    :class="colorFor(t.kind)"
                    role="alert"
                >
                    <component
                        :is="iconFor(t.kind)"
                        class="mt-0.5 h-5 w-5 shrink-0"
                        :class="iconColorFor(t.kind)"
                        aria-hidden="true"
                    />
                    <p class="flex-1 text-sm font-medium leading-relaxed">
                        {{ t.message }}
                    </p>
                    <button
                        type="button"
                        class="ml-auto shrink-0 rounded-lg p-1 opacity-60 transition hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-current"
                        aria-label="Dismiss notification"
                        @click="toast.dismiss(t.id)"
                    >
                        <XMarkIcon class="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            </TransitionGroup>
        </div>
    </Teleport>
</template>
