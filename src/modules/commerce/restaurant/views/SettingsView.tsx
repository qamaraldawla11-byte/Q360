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

            <div className="restaurant-settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px' }}>
                {sections.map((section, i) => (
                    <div key={i} style={{
                        background: 'white', color: '#0f172a', padding: '24px', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)', cursor: 'pointer'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{
                                width: '44px', height: '44px', borderRadius: '12px',
                                background: '#f8fafc', display: 'flex',
                                alignItems: 'center', justifyContent: 'center'
                            }}>
                                <section.icon size={20} color="#64748b" />
                            </div>
                            <div>
                                <h3 style={{ color: '#0f172a', fontSize: '16px', fontWeight: 600, margin: '0 0 4px' }}>{section.title}</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{section.desc}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <style>{`
                @media (max-width: 720px) {
                    .restaurant-settings-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>
        </ModuleShell>
    );
};
