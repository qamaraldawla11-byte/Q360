import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Building2 } from 'lucide-react';

export const BusinessTypeView = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const [businessName, setBusinessName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Get workspace path from previous step (SubSegmentView stored it in lastActiveWorkspace)
    const workspacePath = user?.lastActiveWorkspace || '/app/restaurant';
    const workspaceType = workspacePath.split('/').pop() || 'restaurant';

    const handleFinish = async () => {
        if (!businessName.trim()) return;
        setIsLoading(true);

        // Simulate API call
        await new Promise(r => setTimeout(r, 800));

        // Complete onboarding with architecture-compliant fields
        updateUser({
            onboardingCompleted: true,
            primaryWorkspace: workspacePath,
            lastActiveWorkspace: workspacePath,
            workspaces: [{
                id: `ws_${Date.now()}`,
                type: workspaceType as any,
                name: businessName.trim(),
                path: workspacePath,
                role: user?.role || 'owner'
            }]
        });

        // Redirect to workspace
        navigate(workspacePath);
    };

    return (
        <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                    <label style={{
                        display: 'block',
                        marginBottom: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: 'var(--fg-primary)'
                    }}>
                        Business Name
                    </label>
                    <div style={{ position: 'relative' }}>
                        <Building2
                            size={18}
                            style={{
                                position: 'absolute',
                                left: '14px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--fg-muted)'
                            }}
                        />
                        <input
                            type="text"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            placeholder="My Restaurant"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '14px 16px 14px 44px',
                                borderRadius: '12px',
                                border: '1px solid var(--border-subtle)',
                                fontSize: '15px',
                                outline: 'none'
                            }}
                        />
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '12px', color: 'var(--fg-muted)' }}>
                        You can change this later in Settings.
                    </p>
                </div>

                <div style={{
                    padding: '16px',
                    background: '#f0fdf4',
                    borderRadius: '12px',
                    border: '1px solid #bbf7d0'
                }}>
                    <div style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                        ✓ You selected: {workspaceType.charAt(0).toUpperCase() + workspaceType.slice(1)} OS
                    </div>
                    <div style={{ fontSize: '12px', color: '#15803d', marginTop: '4px' }}>
                        We'll set up your workspace with industry-specific tools.
                    </div>
                </div>

                <button
                    onClick={handleFinish}
                    disabled={!businessName.trim() || isLoading}
                    style={{
                        width: '100%',
                        padding: '16px',
                        background: businessName.trim() && !isLoading ? 'var(--accent-primary)' : '#cbd5e1',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontWeight: 700,
                        fontSize: '15px',
                        cursor: businessName.trim() && !isLoading ? 'pointer' : 'not-allowed',
                        marginTop: '8px'
                    }}
                >
                    {isLoading ? 'Setting up your workspace...' : 'Launch My Workspace'}
                </button>
            </div>
        </div>
    );
};
