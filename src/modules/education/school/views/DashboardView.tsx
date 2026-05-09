import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatCard } from '@/components/shared/StatCard';
import { Users, GraduationCap, Calendar, DollarSign } from 'lucide-react';

export const DashboardView = () => {
    return (
        <ModuleShell>
            <PageHeader
                title="School Dashboard"
                subtitle="Academic and administrative overview"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <StatCard
                    title="Total Students"
                    value="1,247"
                    trend="2%"
                    trendDirection="up"
                    icon={Users}
                />
                <StatCard
                    title="Active Classes"
                    value="42"
                    icon={GraduationCap}
                />
                <StatCard
                    title="Attendance Today"
                    value="94.2%"
                    trend="1%"
                    trendDirection="up"
                    icon={Calendar}
                />
                <StatCard
                    title="Fees Collected"
                    value="$84,320"
                    trend="8%"
                    trendDirection="up"
                    icon={DollarSign}
                />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Today's Schedule</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            { time: '09:00 AM', subject: 'Mathematics - Grade 10' },
                            { time: '10:30 AM', subject: 'Physics - Grade 11' },
                            { time: '12:00 PM', subject: 'English - Grade 9' },
                        ].map((item, i) => (
                            <div key={i} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 600 }}>{item.subject}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{item.time}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Recent Activities</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                            'New student enrollment - Sarah Johnson',
                            'Report card published - Grade 10',
                            'Fee payment received - $2,400',
                        ].map((activity, i) => (
                            <div key={i} style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px' }}>
                                <div style={{ fontSize: '14px' }}>{activity}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ModuleShell>
    );
};
