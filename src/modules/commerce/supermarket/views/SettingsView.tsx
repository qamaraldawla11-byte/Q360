import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Bell, Lock, Palette, Globe, Database, CreditCard, Printer, Mail } from 'lucide-react';

export const SettingsView = () => {
    const sections = [
        {
            title: 'Store Information',
            desc: 'Name, address, business hours, and contact details',
            icon: Globe,
            color: '#10b981'
        },
        {
            title: 'User Permissions',
            desc: 'Manage staff roles and access controls',
            icon: Lock,
            color: '#3b82f6'
        },
        {
            title: 'Notifications',
            desc: 'Alert preferences for inventory, sales, and staff',
            icon: Bell,
            color: '#f59e0b'
        },
        {
            title: 'Display Settings',
            desc: 'Theme, layout, and interface customization',
            icon: Palette,
            color: '#8b5cf6'
        },
        {
            title: 'Payment Gateway',
            desc: 'Configure POS and online payment methods',
            icon: CreditCard,
            color: '#ec4899'
        },
        {
            title: 'Receipt Printer',
            desc: 'Thermal printer configuration and templates',
            icon: Printer,
            color: '#06b6d4'
        },
        {
            title: 'Email Configuration',
            desc: 'SMTP settings for automated notifications',
            icon: Mail,
            color: '#f59e0b'
        },
        {
            title: 'Data Management',
            desc: 'Backup, export, and compliance settings',
            icon: Database,
            color: '#64748b'
        },
    ];

    return (
        <ModuleShell>
            <PageHeader
                title="Settings"
                subtitle="Configure your supermarket system"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {sections.map((section, i) => (
                    <div key={i} style={{
                        background: 'white',
                        padding: '28px',
                        borderRadius: '16px',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = section.color;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border-subtle)';
                            e.currentTarget.style.transform = 'translateY(0)';
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '14px',
                                background: `${section.color}15`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <section.icon size={24} color={section.color} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>{section.title}</h3>
                                <p style={{ fontSize: '13px', color: 'var(--fg-secondary)', lineHeight: 1.4 }}>
                                    {section.desc}
                                </p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ModuleShell>
    );
};
