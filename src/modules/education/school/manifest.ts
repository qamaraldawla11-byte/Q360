import type { VerticalManifest } from '@/types/vertical';
import {
    LayoutDashboard,
    GraduationCap
} from 'lucide-react';

export const schoolManifest: VerticalManifest = {
    id: 'school',
    name: 'School OS',
    shortName: 'School',
    icon: GraduationCap,
    color: '#8b5cf6',
    basePath: '/app/school',
    description: 'Student management, attendance, and academic administration.',

    modules: [
        { id: 'dashboard', label: 'Dashboard', path: '', icon: LayoutDashboard },
    ],

    defaultModule: 'dashboard'
};
