import { useConfigStore } from '@/store/config.store';

export const SettingsView = () => {
    const { theme, setTheme } = useConfigStore();

    return (
        <div>
            <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '24px' }}>System Settings</h1>

            <div style={{
                background: 'var(--bg-panel)',
                padding: '24px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                maxWidth: '600px'
            }}>
                <h2 style={{ fontSize: '18px', margin: '0 0 16px' }}>Appearance</h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={() => setTheme('dark')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${theme === 'dark' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                            background: theme === 'dark' ? 'var(--accent-primary)' : 'transparent',
                            color: theme === 'dark' ? 'white' : 'var(--fg-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        Dark Mode
                    </button>
                    <button
                        onClick={() => setTheme('light')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: 'var(--radius-md)',
                            border: `1px solid ${theme === 'light' ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                            background: theme === 'light' ? 'var(--accent-primary)' : 'transparent',
                            color: theme === 'light' ? 'white' : 'var(--fg-secondary)',
                            cursor: 'pointer'
                        }}
                    >
                        Light Mode
                    </button>
                </div>
            </div>
        </div>
    );
};
