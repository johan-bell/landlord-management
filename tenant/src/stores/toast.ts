import { defineStore } from 'pinia';
import { ref } from 'vue';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export type Toast = {
    id: string;
    kind: ToastKind;
    message: string;
};

let seq = 0;

export const useToastStore = defineStore('toast', () => {
    const toasts = ref<Toast[]>([]);

    function push(kind: ToastKind, message: string, durationMs = 4000) {
        const id = `t${++seq}`;
        toasts.value.push({ id, kind, message });
        window.setTimeout(() => dismiss(id), durationMs);
    }

    function dismiss(id: string) {
        const idx = toasts.value.findIndex((t) => t.id === id);
        if (idx !== -1) toasts.value.splice(idx, 1);
    }

    const success = (msg: string, ms?: number) => push('success', msg, ms);
    const error = (msg: string, ms?: number) => push('error', msg, ms ?? 6000);
    const info = (msg: string, ms?: number) => push('info', msg, ms);
    const warning = (msg: string, ms?: number) => push('warning', msg, ms);

    return { toasts, push, dismiss, success, error, info, warning };
});
