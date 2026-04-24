<script setup lang="ts">
import { RouterView } from 'vue-router';
import ToastNotifications from './components/ToastNotifications.vue';
</script>

<template>
    <RouterView />
    <ToastNotifications />
</template>
