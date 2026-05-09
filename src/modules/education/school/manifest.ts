import type { VerticalManifest } from '@/types/vertical';
import {
    LayoutDashboard,
    GraduationCap,
    Users,
    Calendar,
    DollarSign,
    UserCheck,
    BarChart3,
    Settings
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
        { id: 'students', label: 'Students', path: '/students', icon: Users },
        { id: 'classes', label: 'Classes', path: '/classes', icon: GraduationCap },
        { id: 'attendance', label: 'Attendance', path: '/attendance', icon: Calendar },
        { id: 'fees', label: 'Fees / Billing', path: '/fees', icon: DollarSign },
        { id: 'teachers', label: 'Teachers', path: '/teachers', icon: UserCheck },
        { id: 'reports', label: 'Reports', path: '/reports', icon: BarChart3 },
        { id: 'settings', label: 'Settings', path: '/settings', icon: Settings },
    ],

    defaultModule: 'dashboard'
};
