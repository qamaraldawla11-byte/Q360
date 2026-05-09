import { create } from 'zustand';
import type { BusinessProfile } from '@/types/business';

interface BusinessState {
    profile: BusinessProfile | null;
    setProfile: (profile: BusinessProfile) => void;
    updateProfile: (updates: Partial<BusinessProfile>) => void;
}

export const useBusinessStore = create<BusinessState>((set) => ({
    profile: null,
    setProfile: (profile) => set({ profile }),
    updateProfile: (updates) => set((state) => ({
        profile: state.profile ? { ...state.profile, ...updates } : null
    })),
}));
