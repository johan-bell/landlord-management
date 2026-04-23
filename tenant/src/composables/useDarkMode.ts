import { onMounted, ref } from 'vue';

const STORAGE_KEY = 'lm_tenant_dark';

const dark = ref(false);

function apply(v: boolean) {
    dark.value = v;
    if (v) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, v ? '1' : '0');
}

export function useDarkMode() {
    function toggle() {
        apply(!dark.value);
    }

    onMounted(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        const preferred =
            stored !== null
                ? stored === '1'
                : window.matchMedia('(prefers-color-scheme: dark)').matches;
        apply(preferred);
    });

    return { dark, toggle };
}
