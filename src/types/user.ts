export type UserRole = 'owner' | 'admin' | 'manager' | 'staff';
export type UserType = 'sme' | 'personal';
export type UserSegment =
    | 'restaurant'
    | 'pharmacy'
    | 'supermarket'
    | 'retail'
    | 'autoparts'
    | 'clinic'
    | 'services'
    | 'other'
    | 'personal_freelancer'
    | 'personal_consultant'
    | 'personal_creative';

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
    userType: UserType | null;
    segment: UserSegment | null;
    businessName?: string | null;
    country?: string | null;
    currency?: string | null;

    // CRITICAL FLAGS (per architecture spec)
    onboardingCompleted: boolean;
    primaryWorkspace: string | null;

    // MULTI-BUSINESS (future-ready)
    workspaces: WorkspaceRef[];
    lastActiveWorkspace?: string;
}
