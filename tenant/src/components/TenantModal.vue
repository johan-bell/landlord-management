<script setup lang="ts">
import { nextTick, onUnmounted, ref, useId, watch } from 'vue';

const props = defineProps<{
    open: boolean;
    title: string;
}>();

const emit = defineEmits<{
    'update:open': [value: boolean];
}>();

const titleId = useId();
const panelRef = ref<HTMLElement | null>(null);

function close() {
    emit('update:open', false);
}

function onBackdropClick() {
    close();
}

function onOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
    }
}

watch(
    () => props.open,
    (v) => {
        if (v) {
            document.body.style.overflow = 'hidden';
            void nextTick(() => {
                const panel = panelRef.value;
                if (!panel) return;
                const field =
                    panel.querySelector<HTMLElement>(
                        'input:not([type="hidden"]), textarea',
                    ) ??
                    panel.querySelector<HTMLElement>('button:not([disabled])');
                field?.focus();
            });
        } else {
            document.body.style.overflow = '';
        }
    },
);

onUnmounted(() => {
    document.body.style.overflow = '';
});
</script>

<template>
    <Teleport to="body">
        <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
        >
            <div
                v-if="open"
                class="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center sm:p-6"
                role="presentation"
                @keydown="onOverlayKeydown"
            >
                <div
                    class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
                    aria-hidden="true"
                    @click="onBackdropClick"
                />
                <div
                    ref="panelRef"
                    class="relative max-h-[min(90vh,40rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl shadow-slate-900/20 ring-1 ring-slate-900/5"
                    role="dialog"
                    aria-modal="true"
                    :aria-labelledby="titleId"
                    @click.stop
                >
                    <div class="flex items-start justify-between gap-3">
                        <h2
                            :id="titleId"
                            class="text-lg font-semibold tracking-tight text-slate-900"
                        >
                            {{ title }}
                        </h2>
                        <button
                            type="button"
                            class="shrink-0 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                            aria-label="Close"
                            @click="close"
                        >
                            <svg
                                class="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                                aria-hidden="true"
                            >
                                <path
                                    d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                                />
                            </svg>
                        </button>
                    </div>
                    <div class="mt-5">
                        <slot />
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>
