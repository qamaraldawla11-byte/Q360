import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth.store';
import { Button, Field, Input } from '@/components/design-system';

export const IdentityView = () => {
    const navigate = useNavigate();
    const { user, updateUser } = useAuthStore();
    const [name, setName] = useState(user?.name || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        updateUser({ name: name.trim(), userType: 'sme' });
        navigate('/onboarding/type');
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--q-space-6)' }}>
            <Field label="Full Name">
                <Input
                    id="onboarding-full-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    autoFocus
                />
            </Field>

            <Field label="Email Address" hint="You signed in with this email.">
                <Input
                    id="onboarding-email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                />
            </Field>

            <Button
                type="submit"
                variant="primary"
                fullWidth
                disabled={!name.trim()}
            >
                Continue
            </Button>
        </form>
    );
};
