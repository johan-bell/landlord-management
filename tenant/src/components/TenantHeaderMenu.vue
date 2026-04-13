<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

withDefaults(
  defineProps<{
    initials: string;
    menuLabel: string;
    showPassword?: boolean;
    showSupport?: boolean;
  }>(),
  { showPassword: false, showSupport: false },
);

const emit = defineEmits<{
  signOut: [];
  goPassword: [];
  goSupport: [];
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
      class="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white py-1.5 pl-1.5 pr-2 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      :aria-expanded="open"
      :aria-haspopup="true"
      :aria-label="menuLabel"
      @click.stop="toggle"
    >
      <span
        class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-sm font-bold text-white shadow-md shadow-teal-900/15"
        aria-hidden="true"
      >
        {{ initials }}
      </span>
      <svg
        class="h-4 w-4 text-slate-500 transition-transform duration-200"
        :class="open ? 'rotate-180' : ''"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
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
        class="absolute right-0 z-40 mt-2 min-w-[13.5rem] overflow-hidden rounded-2xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5"
        role="menu"
        :aria-label="menuLabel"
      >
        <button
          v-if="showPassword"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
          role="menuitem"
          @click="onPassword"
        >
          <svg class="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
              clip-rule="evenodd"
            />
          </svg>
          Change password
        </button>
        <button
          v-if="showSupport"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-slate-50"
          role="menuitem"
          @click="onSupport"
        >
          <svg class="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M3.505 2.365A41.369 41.369 0 0117 2.73c.483.75.994 1.64.924 3.13-.08 1.87-.902 3.1-1.84 4.042-.962.963-2.11 1.69-3.296 2.235a.75.75 0 01-.894-.894c.35-.613.656-1.281.884-2.006a.75.75 0 00-.894-.894c-.457.22-.97.38-1.508.48A41.36 41.36 0 013 13.5c-.806 0-1.48-.25-1.995-.575a10.59 10.59 0 01-.344-.25C1.5 12.44 1 11.793 1 11.25V8.75c0-.495.253-.948.659-1.28.06-.047.122-.094.19-.136.065-.04.131-.078.2-.114.094-.052.192-.104.295-.154L1 5.5c0-.644.517-1.17 1.155-1.248l15-1.77z"
            />
          </svg>
          Support request
        </button>

        <div
          v-if="showPassword || showSupport"
          class="my-1 border-t border-slate-100"
          role="presentation"
        />

        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
          role="menuitem"
          @click="onSignOut"
        >
          <svg class="h-4 w-4 shrink-0 text-red-500/90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
              clip-rule="evenodd"
            />
            <path
              fill-rule="evenodd"
              d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114L8.704 10.75H18.25A.75.75 0 0019 10z"
              clip-rule="evenodd"
            />
          </svg>
          Sign out
        </button>
      </div>
    </Transition>
  </div>
</template>
