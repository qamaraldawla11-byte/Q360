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

export const useBusinessModulesStore = create<BusinessModulesState>((set, get) => ({
    modules: [], loaded: false, loading: false,
    load: async (force = false) => {
        if (get().loading || (get().loaded && !force)) return;
        set({ loading: true });
        try {
            const result = await businessApi.getModules();
            set({ modules: result.modules, loaded: true });
        } finally { set({ loading: false }); }
    },
    setEnabled: async (moduleKey, enabled) => {
        const updated = await businessApi.setModuleEnabled(moduleKey, enabled);
        set(state => ({ modules: state.modules.map(module => module.moduleKey === moduleKey ? updated : module) }));
        window.dispatchEvent(new CustomEvent('q360:business-module-changed', { detail: updated }));
    },
    isEnabled: moduleKey => get().modules.find(module => module.moduleKey === moduleKey)?.enabled ?? true,
}));
