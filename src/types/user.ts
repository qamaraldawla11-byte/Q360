export type UserRole = 'owner' | 'admin' | 'manager' | 'staff';

export interface WorkspaceRef {
    id: string;
    type: 'restaurant' | 'pharmacy' | 'supermarket' | 'school' | 'supplier';
    name: string;
    path: string;
    role: UserRole;
}

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    avatar?: string;

    // CRITICAL FLAGS (per architecture spec)
    onboardingCompleted: boolean;
    primaryWorkspace: string | null;

    // MULTI-BUSINESS (future-ready)
    workspaces: WorkspaceRef[];
    lastActiveWorkspace?: string;
}
