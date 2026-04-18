/**
 * Client-side feature toggles (Vite env). Set to "false" to disable.
 */
export const platformFeatures = {
    internalNotes:
        import.meta.env.VITE_FEATURE_PLATFORM_INTERNAL_NOTES !== 'false',
    onboardingCard:
        import.meta.env.VITE_FEATURE_PLATFORM_ONBOARDING !== 'false',
    analyticsCard:
        import.meta.env.VITE_FEATURE_PLATFORM_ANALYTICS !== 'false',
} as const;
