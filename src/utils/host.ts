// Platform Operations host detection and cross-origin constants.
// Architecture authority: docs/adr/ADR_PLATFORM_OPERATIONS_EXPERIENCE.md
//
// The Platform Operations experience is host-selected: the same build mounts
// either the tenant Workspace shell or the Platform shell depending on the
// hostname. Both experiences share one repository, one Vite build, one
// backend, one auth foundation, and one design system.

const PLATFORM_HOSTNAMES = ['admin.q360.app'];

export const isPlatformHost = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (PLATFORM_HOSTNAMES.includes(window.location.hostname)) return true;
    // Development/preview opt-in: VITE_PLATFORM_HOST=true makes the current
    // origin render the Platform shell (e.g. local testing on localhost).
    return import.meta.env.VITE_PLATFORM_HOST === 'true';
};

// Absolute URL of the Platform Operations origin.
export const PLATFORM_APP_URL: string =
    import.meta.env.VITE_PLATFORM_APP_URL || 'https://admin.q360.app';

// Absolute URL of the tenant Workspace origin. q360.vercel.app is the current
// de-facto tenant origin; app.q360.app is the target state (see ADR §4).
export const TENANT_APP_URL: string =
    import.meta.env.VITE_TENANT_APP_URL || 'https://q360.vercel.app';

// Environment identity must be visible on every Platform screen (ADR §5.6).
export const environmentLabel = (): string => {
    if (typeof window === 'undefined') return 'PRODUCTION';
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'DEVELOPMENT';
    if (host.endsWith('-git-') || host.includes('-git-')) return 'PREVIEW';
    return 'PRODUCTION';
};
