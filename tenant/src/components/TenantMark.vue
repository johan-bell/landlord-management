<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'md' | 'lg';
    variant?: 'stack' | 'inline';
  }>(),
  { size: 'md', variant: 'stack' },
);
</script>

<template>
  <div
    class="flex text-center"
    :class="variant === 'inline' ? 'flex-row items-center gap-3 text-left' : 'flex-col items-center'"
  >
    <div
      class="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 font-bold text-white shadow-md shadow-teal-900/20 ring-2 ring-white/20"
      :class="size === 'lg' ? 'h-14 w-14 text-xl' : 'h-10 w-10 text-sm'"
    >
      LM
    </div>
    <div :class="variant === 'inline' ? 'min-w-0' : ''">
      <p v-if="variant === 'stack'" class="mt-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700/90">
        Renter portal
      </p>
      <template v-else>
        <p class="text-sm font-semibold text-slate-900">Renter</p>
        <p class="truncate text-xs text-slate-500"><slot name="subtitle" /></p>
      </template>
    </div>
  </div>
</template>
