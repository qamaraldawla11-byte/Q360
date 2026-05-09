import { useState } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Users, Clock, Calendar, CheckCircle } from 'lucide-react';

interface Staff {
    id: string;
    name: string;
    role: string;
    email: string;
    phone: string;
    status: 'active' | 'off';
}

interface Shift {
    id: string;
    staffId: string;
    staffName: string;
    date: string;
    startTime: string;
    endTime: string;
    role: string;
    status: 'scheduled' | 'ongoing' | 'completed';
}

export const StaffView = () => {
    const [activeTab, setActiveTab] = useState<'staff' | 'shifts'>('staff');

    const staff: Staff[] = [
        { id: '1', name: 'John Smith', role: 'Store Manager', email: 'john@supermarket.com', phone: '+1 234 567 8900', status: 'active' },
        { id: '2', name: 'Sarah Johnson', role: 'Cashier', email: 'sarah@supermarket.com', phone: '+1 234 567 8901', status: 'active' },
        { id: '3', name: 'Mike Chen', role: 'Stock Clerk', email: 'mike@supermarket.com', phone: '+1 234 567 8902', status: 'active' },
        { id: '4', name: 'Lisa Brown', role: 'Cashier', email: 'lisa@supermarket.com', phone: '+1 234 567 8903', status: 'off' },
    ];

    const shifts: Shift[] = [
        { id: '1', staffId: '1', staffName: 'John Smith', date: '2026-01-09', startTime: '08:00', endTime: '16:00', role: 'Store Manager', status: 'ongoing' },
        { id: '2', staffId: '2', staffName: 'Sarah Johnson', date: '2026-01-09', startTime: '09:00', endTime: '17:00', role: 'Cashier', status: 'ongoing' },
        { id: '3', staffId: '3', staffName: 'Mike Chen', date: '2026-01-09', startTime: '10:00', endTime: '18:00', role: 'Stock Clerk', status: 'scheduled' },
        { id: '4', staffId: '2', staffName: 'Sarah Johnson', date: '2026-01-08', startTime: '09:00', endTime: '17:00', role: 'Cashier', status: 'completed' },
    ];

    return (
        <ModuleShell>
            <PageHeader
                title="Staff & Shifts"
                subtitle="Manage team members and work schedules"
            />

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                {[
                    { label: 'Active Staff', value: staff.filter(s => s.status === 'active').length.toString(), icon: Users, color: '#10b981' },
                    { label: 'On Duty Now', value: shifts.filter(s => s.status === 'ongoing').length.toString(), icon: Clock, color: '#3b82f6' },
                    { label: "Today's Shifts", value: shifts.filter(s => s.date === '2026-01-09').length.toString(), icon: Calendar, color: '#f59e0b' },
                    { label: 'Completed', value: shifts.filter(s => s.status === 'completed').length.toString(), icon: CheckCircle, color: '#8b5cf6' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '24px', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{
                                width: '40px', height: '40px', borderRadius: '10px',
                                background: `${stat.color}15`, color: stat.color,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <stat.icon size={20} />
                            </div>
                            <div>
                                <div style={{ fontSize: '28px', fontWeight: 700 }}>{stat.value}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{stat.label}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-subtle)' }}>
                {(['staff', 'shifts'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            background: 'transparent',
                            borderBottom: activeTab === tab ? '2px solid #10b981' : '2px solid transparent',
                            marginBottom: '-2px',
                            fontWeight: activeTab === tab ? 700 : 500,
                            color: activeTab === tab ? '#10b981' : 'var(--fg-secondary)',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            fontSize: '14px'
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Content */}
            {activeTab === 'staff' ? (
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Name</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Role</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Contact</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Status</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staff.map((member) => (
                                <tr key={member.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '16px 20px', fontWeight: 600 }}>{member.name}</td>
                                    <td style={{ padding: '16px 20px' }}>{member.role}</td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <div style={{ fontSize: '13px' }}>{member.email}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>{member.phone}</div>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            background: member.status === 'active' ? '#dcfce7' : '#f3f4f6',
                                            color: member.status === 'active' ? '#166534' : '#6b7280'
                                        }}>
                                            {member.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <button style={{
                                            padding: '6px 14px',
                                            background: 'white',
                                            border: '1px solid var(--border-subtle)',
                                            borderRadius: '8px',
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}>
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div style={{ background: 'white', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Staff</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Date</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Time</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Role</th>
                                <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: '13px', fontWeight: 600 }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shifts.map((shift) => (
                                <tr key={shift.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: '16px 20px', fontWeight: 600 }}>{shift.staffName}</td>
                                    <td style={{ padding: '16px 20px' }}>{shift.date}</td>
                                    <td style={{ padding: '16px 20px' }}>{shift.startTime} - {shift.endTime}</td>
                                    <td style={{ padding: '16px 20px', fontSize: '13px', color: 'var(--fg-secondary)' }}>{shift.role}</td>
                                    <td style={{ padding: '16px 20px' }}>
                                        <span style={{
                                            padding: '4px 12px',
                                            borderRadius: '12px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            background: shift.status === 'ongoing' ? '#dcfce7' : shift.status === 'scheduled' ? '#dbeafe' : '#f3f4f6',
                                            color: shift.status === 'ongoing' ? '#166534' : shift.status === 'scheduled' ? '#1e40af' : '#6b7280'
                                        }}>
                                            {shift.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </ModuleShell>
    );
};
