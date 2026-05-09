import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Bell, Lock, Palette, Globe, Database, CreditCard } from 'lucide-react';

export const SettingsView = () => {
    const sections = [
        { title: 'Business Profile', desc: 'Name, address, and contact information', icon: Globe },
        { title: 'Users & Permissions', desc: 'Manage staff access and roles', icon: Lock },
        { title: 'Notifications', desc: 'Alert preferences and channels', icon: Bell },
        { title: 'Appearance', desc: 'Theme and display settings', icon: Palette },
        { title: 'Payment Methods', desc: 'Configure payment gateways', icon: CreditCard },
        { title: 'Data & Privacy', desc: 'Backup, export, and compliance', icon: Database },
    ];

    return (
        <ModuleShell>
            <PageHeader 
                title="Settings"
                subtitle="Configure your restaurant system"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
                {sections.map((section, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '24px', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)', cursor: 'pointer'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '12px',
                                background: '#f8fafc', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <section.icon size={20} color="var(--fg-secondary)" />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{section.title}</h3>
                                <p style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{section.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </ModuleShell>
    );
};
