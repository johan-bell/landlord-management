<script setup lang="ts">
import {
    ArrowRightStartOnRectangleIcon,
    ChevronDownIcon,
} from '@heroicons/vue/20/solid';
import { onMounted, onUnmounted, ref } from 'vue';

withDefaults(
    defineProps<{
        initials: string;
        menuLabel: string;
        email: string;
        orgName: string | null;
        orgRoleLabel: string | null;
        /** Short explanation of what this role can do in the selected org. */
        orgRoleHint?: string | null;
        isPlatformAdmin?: boolean;
    }>(),
    { isPlatformAdmin: false, orgRoleHint: null },
);

const emit = defineEmits<{
    signOut: [];
}>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle() {
    open.value = !open.value;
}

function close() {
    open.value = false;
}

function onDocPointerDown(e: PointerEvent) {
    if (!open.value || !root.value) return;
    if (!root.value.contains(e.target as Node)) close();
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
}

function onSignOut() {
    emit('signOut');
    close();
}

onMounted(() => {
    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
    <div ref="root" class="relative shrink-0">
        <button
            type="button"
            class="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200/90 bg-white py-0 pl-1.5 pr-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            :aria-expanded="open"
            :aria-haspopup="true"
            :aria-label="menuLabel"
            @click.stop="toggle"
        >
            <span
                class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white shadow-sm shadow-emerald-900/20"
                aria-hidden="true"
            >
                {{ initials }}
            </span>
            <ChevronDownIcon
                class="h-4 w-4 text-slate-500 transition-transform duration-200"
                :class="open ? 'rotate-180' : ''"
                aria-hidden="true"
            />
        </button>

        <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-0.5"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100"
            leave-to-class="opacity-0 scale-95"
        >
            <div
                v-show="open"
                class="absolute right-0 z-40 mt-2 w-[min(calc(100vw-2rem),17.5rem)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
                role="menu"
                :aria-label="menuLabel"
            >
                <div class="border-b border-slate-100 px-4 py-3">
                    <p class="text-xs font-medium text-slate-500">
                        Signed in as
                    </p>
                    <p
                        class="mt-0.5 break-all text-sm font-semibold text-slate-900"
                    >
                        {{ email }}
                    </p>
                    <p
                        v-if="isPlatformAdmin"
                        class="mt-2 inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200/80"
                    >
                        Platform admin
                    </p>
                    <p
                        v-if="orgName && orgRoleLabel"
                        class="mt-2 text-xs leading-relaxed text-slate-600"
                    >
                        <span class="text-slate-500">Role in</span>
                        <span class="font-medium text-slate-800">
                            {{ ' ' }}{{ orgName }}</span>
                        <span class="text-slate-400"> · </span>
                        <span class="font-semibold text-slate-900">{{
                            orgRoleLabel
                        }}</span>
                    </p>
                    <p
                        v-if="orgName && orgRoleLabel && orgRoleHint"
                        class="mt-1.5 text-[11px] leading-snug text-slate-500"
                    >
                        {{ orgRoleHint }}
                    </p>
                    <p
                        v-else-if="orgName && !orgRoleLabel"
                        class="mt-2 text-xs text-slate-500"
                    >
                        Role will appear once this organization is loaded.
                    </p>
                    <p
                        v-else-if="!isPlatformAdmin"
                        class="mt-2 text-xs text-slate-500"
                    >
                        Choose an organization to see your role.
                    </p>
                </div>

                <button
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                    role="menuitem"
                    @click="onSignOut"
                >
                    <ArrowRightStartOnRectangleIcon
                        class="h-4 w-4 shrink-0 text-red-500/90"
                        aria-hidden="true"
                    />
                    Sign out
                </button>
            </div>
        </Transition>
    </div>
</template>
