<script setup lang="ts">
import {
    ArrowRightStartOnRectangleIcon,
    ChatBubbleLeftRightIcon,
    ChevronDownIcon,
    LockClosedIcon,
    MoonIcon,
    SunIcon,
} from '@heroicons/vue/20/solid';
import { onMounted, onUnmounted, ref } from 'vue';

const props = withDefaults(
    defineProps<{
        initials: string;
        menuLabel: string;
        showPassword?: boolean;
        showSupport?: boolean;
        locale?: string;
        dark?: boolean;
    }>(),
    { showPassword: false, showSupport: false, locale: 'en', dark: false },
);

const emit = defineEmits<{
    signOut: [];
    goPassword: [];
    goSupport: [];
    changeLang: [code: string];
    toggleDark: [];
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

function onPassword() {
    emit('goPassword');
    close();
}

function onSupport() {
    emit('goSupport');
    close();
}

function onSignOut() {
    emit('signOut');
    close();
}

function onChangeLang(code: string) {
    emit('changeLang', code);
}

function onToggleDark() {
    emit('toggleDark');
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
            class="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white py-1.5 pl-1.5 pr-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-800 dark:hover:bg-slate-700"
            :aria-expanded="open"
            :aria-haspopup="true"
            :aria-label="menuLabel"
            @click.stop="toggle"
        >
            <span
                class="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-md shadow-teal-900/15"
                aria-hidden="true"
            >
                {{ initials }}
            </span>
            <ChevronDownIcon
                class="h-4 w-4 text-slate-500 transition-transform duration-200 dark:text-slate-400"
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
                class="absolute right-0 z-40 mt-2 min-w-54 overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 dark:border-slate-700/80 dark:bg-slate-800 dark:ring-slate-900/20"
                role="menu"
                :aria-label="menuLabel"
            >
                <div
                    class="flex items-center gap-1 px-3 py-2"
                    role="group"
                    aria-label="Language"
                >
                    <span
                        class="mr-1 text-xs text-slate-500 dark:text-slate-400"
                        >Lang</span
                    >
                    <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                        :class="
                            props.locale === 'en'
                                ? 'bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-300'
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                        "
                        :aria-pressed="props.locale === 'en'"
                        @click="onChangeLang('en')"
                    >
                        EN
                    </button>
                    <button
                        type="button"
                        class="rounded-lg px-2.5 py-1 text-xs font-semibold transition"
                        :class="
                            props.locale === 'fr'
                                ? 'bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-300'
                                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
                        "
                        :aria-pressed="props.locale === 'fr'"
                        @click="onChangeLang('fr')"
                    >
                        FR
                    </button>
                    <button
                        type="button"
                        class="ml-auto rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                        :aria-label="
                            props.dark
                                ? 'Switch to light mode'
                                : 'Switch to dark mode'
                        "
                        @click="onToggleDark"
                    >
                        <MoonIcon
                            v-if="!props.dark"
                            class="h-4 w-4"
                            aria-hidden="true"
                        />
                        <SunIcon v-else class="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>

                <div
                    class="my-1 border-t border-slate-100 dark:border-slate-700/60"
                    role="presentation"
                />

                <button
                    v-if="showPassword"
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    role="menuitem"
                    @click="onPassword"
                >
                    <LockClosedIcon
                        class="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                        aria-hidden="true"
                    />
                    Change password
                </button>
                <button
                    v-if="showSupport"
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60"
                    role="menuitem"
                    @click="onSupport"
                >
                    <ChatBubbleLeftRightIcon
                        class="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500"
                        aria-hidden="true"
                    />
                    Support request
                </button>

                <div
                    v-if="showPassword || showSupport"
                    class="my-1 border-t border-slate-100 dark:border-slate-700/60"
                    role="presentation"
                />

                <button
                    type="button"
                    class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
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
