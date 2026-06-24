import { useEffect, useState } from 'react';
import { adminApi, type AdminSetting } from '@/api/admin.api';

// Predefined feature flags
const FEATURE_FLAGS = [
    { key: 'MAINTENANCE_MODE', description: 'Enable maintenance mode - users see maintenance page', isBoolean: true },
    { key: 'READ_ONLY_MODE', description: 'Enable read-only mode - disable all write operations', isBoolean: true },
    { key: 'DISABLE_SIGNUPS', description: 'Disable new user registrations', isBoolean: true },
];

export const SettingsPage = () => {
    const [settings, setSettings] = useState<AdminSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getSettings();
            setSettings(data);
        } catch (err) {
            console.error('Failed to load settings:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSave = async (key: string, value: string, description?: string) => {
        setSaving(key);
        try {
            await adminApi.saveSetting({ key, value, description });
            fetchSettings();
        } catch {
            alert('Error saving setting');
        } finally {
            setSaving(null);
        }
    };

    const handleToggle = async (flag: typeof FEATURE_FLAGS[0]) => {
        const existing = settings.find(s => s.key === flag.key);
        const currentValue = existing?.value === 'true';
        await handleSave(flag.key, (!currentValue).toString(), flag.description);
    };

    const getSettingValue = (key: string) => {
        return settings.find(s => s.key === key)?.value;
    };

    if (loading) return <div>Loading settings...</div>;

    return (
        <div>
            <h2>System Settings & Feature Flags</h2>

            {/* Feature Flags Section */}
            <div style={{ marginTop: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#9ca3af' }}>Feature Flags</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px' }}>
                    {FEATURE_FLAGS.map(flag => {
                        const isEnabled = getSettingValue(flag.key) === 'true';
                        return (
                            <div key={flag.key} style={{
                                padding: '15px', background: '#1f2937', borderRadius: '8px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{flag.key}</div>
                                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{flag.description}</div>
                                </div>
                                <button
                                    onClick={() => handleToggle(flag)}
                                    disabled={saving === flag.key}
                                    style={{
                                        padding: '8px 20px',
                                        background: isEnabled ? '#ef4444' : '#10b981',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: saving === flag.key ? 'not-allowed' : 'pointer',
                                        minWidth: '80px'
                                    }}
                                >
                                    {saving === flag.key ? '...' : (isEnabled ? 'OFF' : 'ON')}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* All Settings Section */}
            <div style={{ marginTop: '40px', borderTop: '1px solid #374151', paddingTop: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#9ca3af' }}>All Settings</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px' }}>
                    {settings.length === 0 && <p>No settings defined yet.</p>}

                    {settings.map(setting => (
                        <div key={setting.key} style={{ padding: '15px', background: '#1f2937', borderRadius: '8px' }}>
                            <div style={{ fontWeight: 600, marginBottom: '5px' }}>{setting.key}</div>
                            <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '10px' }}>{setting.description}</div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    defaultValue={setting.value}
                                    style={{ flex: 1, padding: '8px' }}
                                    id={`input-${setting.key}`}
                                />
                                <button
                                    onClick={() => {
                                        const val = (document.getElementById(`input-${setting.key}`) as HTMLInputElement).value;
                                        handleSave(setting.key, val, setting.description);
                                    }}
                                    disabled={saving === setting.key}
                                    style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}
                                >
                                    {saving === setting.key ? '...' : 'Save'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add New Setting */}
            <div style={{ marginTop: '40px', borderTop: '1px solid #374151', paddingTop: '20px', maxWidth: '600px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#9ca3af' }}>Add New Setting</h3>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const formData = new FormData(target);
                    const key = String(formData.get('key') || '');
                    const value = String(formData.get('value') || '');
                    const desc = String(formData.get('desc') || '');
                    if (key && value) {
                        handleSave(key, value, desc).then(() => {
                            target.reset();
                        });
                    }
                }}>
                    <div style={{ display: 'grid', gap: '10px' }}>
                        <input name="key" placeholder="Key (e.g. SYSTEM_MAINTENANCE)" style={{ padding: '8px' }} />
                        <input name="value" placeholder="Value (e.g. true)" style={{ padding: '8px' }} />
                        <input name="desc" placeholder="Description" style={{ padding: '8px' }} />
                        <button type="submit" style={{ padding: '8px', background: '#10b981', color: 'white', border: 'none' }}>Add Setting</button>
                    </div>
                </form>
            </div>
        </div>
    );
};
