import { create } from 'zustand';
import { businessApi, type BusinessModule } from '@/api/business.api';

interface BusinessModulesState {
    modules: BusinessModule[];
    loaded: boolean;
    loading: boolean;
    load: (force?: boolean) => Promise<void>;
    setEnabled: (moduleKey: string, enabled: boolean) => Promise<void>;
    isEnabled: (moduleKey: string) => boolean;
}

/**
 * CORE-M1: the store holds the canonical shared modules (workspaceKey
 * 'shared') and the workspace-scoped modules (workspaceKey 'restaurant') in
 * one list. Shared modules are authoritative and appear exactly once;
 * workspace modules keep their workspace section. Frontend state is display
 * and compatibility only — authorization is always enforced server-side.
 */
export const useBusinessModulesStore = create<BusinessModulesState>((set, get) => ({
    modules: [], loaded: false, loading: false,
    load: async (force = false) => {
        if (get().loading || (get().loaded && !force)) return;
        set({ loading: true });
        try {
            const [shared, workspace] = await Promise.all([
                businessApi.getSharedModules(),
                businessApi.getModules(),
            ]);
            set({ modules: [...shared.modules, ...workspace.modules], loaded: true });
        } finally { set({ loading: false }); }
    },
    setEnabled: async (moduleKey, enabled) => {
        const current = get().modules.find(module => module.moduleKey === moduleKey);
        const updated = await businessApi.setModuleEnabled(moduleKey, enabled, current?.workspaceKey ?? 'restaurant');
        set(state => ({ modules: state.modules.map(module => module.moduleKey === moduleKey ? updated : module) }));
        window.dispatchEvent(new CustomEvent('q360:business-module-changed', { detail: updated }));
    },
    isEnabled: moduleKey => get().modules.find(module => module.moduleKey === moduleKey)?.enabled ?? true,
}));
