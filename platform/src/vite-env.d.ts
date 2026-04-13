/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL?: string;
    /** Base URL of the landlord admin app (for staff invite links), e.g. http://localhost:5173 */
    readonly VITE_ADMIN_PUBLIC_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
