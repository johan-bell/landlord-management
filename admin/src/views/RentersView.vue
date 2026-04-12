<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { api } from '../lib/api';
import { useOrgContext } from '../composables/useOrgContext';
import type { Renter } from '../types/models';
import SelectOrgPrompt from '../components/SelectOrgPrompt.vue';

const { hasOrg, orgApi } = useOrgContext();

const renters = ref<Renter[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const showAdd = ref(false);
const form = ref({ fullName: '', phone: '', email: '' });
const saving = ref(false);

async function load() {
  if (!hasOrg.value) return;
  loading.value = true;
  error.value = null;
  try {
    renters.value = await api<Renter[]>(orgApi('/renters'));
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load';
  } finally {
    loading.value = false;
  }
}

async function save() {
  const fullName = form.value.fullName.trim();
  if (!fullName) return;
  saving.value = true;
  try {
    await api(orgApi('/renters'), {
      method: 'POST',
      body: JSON.stringify({
        fullName,
        phone: form.value.phone.trim() || undefined,
        email: form.value.email.trim() || undefined,
      }),
    });
    form.value = { fullName: '', phone: '', email: '' };
    showAdd.value = false;
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Save failed';
  } finally {
    saving.value = false;
  }
}

async function remove(r: Renter) {
  if (!confirm(`Remove ${r.fullName} from this organization?`)) return;
  try {
    await api(orgApi(`/renters/${r.id}`), { method: 'DELETE' });
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Delete failed';
  }
}

onMounted(() => void load());
watch(hasOrg, () => void load());
</script>

<template>
  <div>
    <SelectOrgPrompt v-if="!hasOrg" />

    <template v-else>
      <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-slate-600">People who rent units under this organization.</p>
        <button
          type="button"
          class="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          @click="showAdd = true"
        >
          Add renter
        </button>
      </div>

      <p v-if="error" class="mb-4 text-sm text-red-600">{{ error }}</p>

      <div
        v-if="loading"
        class="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500"
      >
        Loading…
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Name</th>
              <th class="hidden px-4 py-3 sm:table-cell">Phone</th>
              <th class="hidden px-4 py-3 md:table-cell">Email</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="r in renters" :key="r.id" class="hover:bg-slate-50/80">
              <td class="px-4 py-3 font-medium text-slate-900">{{ r.fullName }}</td>
              <td class="hidden px-4 py-3 text-slate-600 sm:table-cell">{{ r.phone ?? '—' }}</td>
              <td class="hidden px-4 py-3 text-slate-600 md:table-cell">{{ r.email ?? '—' }}</td>
              <td class="px-4 py-3 text-right">
                <button type="button" class="text-sm font-medium text-red-600 hover:underline" @click="remove(r)">
                  Remove
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="!renters.length" class="px-4 py-10 text-center text-sm text-slate-500">No renters yet.</p>
      </div>

      <Teleport to="body">
        <div
          v-if="showAdd"
          class="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
          @click.self="showAdd = false"
        >
          <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" @click.stop>
            <h3 class="text-lg font-semibold">New renter</h3>
            <label class="mt-4 block">
              <span class="text-sm font-medium">Full name</span>
              <input v-model="form.fullName" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label class="mt-3 block">
              <span class="text-sm font-medium">Phone (optional)</span>
              <input v-model="form.phone" class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2" />
            </label>
            <label class="mt-3 block">
              <span class="text-sm font-medium">Email (optional)</span>
              <input
                v-model="form.email"
                type="email"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </label>
            <div class="mt-6 flex justify-end gap-2">
              <button type="button" class="rounded-xl px-4 py-2 text-sm text-slate-600" @click="showAdd = false">
                Cancel
              </button>
              <button
                type="button"
                class="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                :disabled="saving || !form.fullName.trim()"
                @click="save"
              >
                {{ saving ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </template>
  </div>
</template>
