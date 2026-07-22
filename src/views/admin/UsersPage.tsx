import { useEffect, useState } from 'react';
import { adminApi, type AdminUser } from '@/api/admin.api';

export const UsersPage = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const [newUser, setNewUser] = useState({ email: '', role: 'user', businessId: '', name: '' });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getUsers();
            setUsers(data);
        } catch {
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async () => {
        if (!newUser.businessId.trim()) return;
        try {
            await adminApi.createUser(newUser);
            setShowModal(false);
            setNewUser({ email: '', role: 'user', businessId: '', name: '' });
            fetchUsers();
        } catch {
            alert('Failed to create user');
        }
    };

    const handleUserAction = async (userId: string, action: 'activate' | 'deactivate' | 'lock' | 'unlock') => {
        setActionLoading(userId);
        try {
            switch (action) {
                case 'activate': await adminApi.activateUser(userId); break;
                case 'deactivate': await adminApi.deactivateUser(userId); break;
                case 'lock': await adminApi.lockUser(userId); break;
                case 'unlock': await adminApi.unlockUser(userId); break;
            }
            fetchUsers();
        } catch {
            alert(`Failed to ${action} user`);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div>Loading users...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2>Users Management</h2>
                <button
                    onClick={() => setShowModal(true)}
                    style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    + Add User
                </button>
            </div>

            {error && <div style={{ color: 'red' }}>{error}</div>}

            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px', minWidth: '400px' }}>
                        <h3>Add New User</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                            <input
                                placeholder="Email"
                                value={newUser.email}
                                onChange={e => setNewUser({ ...newUser, email: e.target.value })}
                                style={{ padding: '8px' }}
                            />
                            <input
                                placeholder="Name"
                                value={newUser.name}
                                onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                style={{ padding: '8px' }}
                            />
                            <input
                                placeholder="Business ID (existing tenant, e.g. biz_...)"
                                value={newUser.businessId}
                                onChange={e => setNewUser({ ...newUser, businessId: e.target.value })}
                                style={{ padding: '8px' }}
                            />
                            {!newUser.businessId.trim() && (
                                <div style={{ color: '#f59e0b', fontSize: '12px' }}>
                                    An existing business ID is required. The user will be attached to that tenant.
                                </div>
                            )}
                            <select
                                value={newUser.role}
                                onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                style={{ padding: '8px' }}
                            >
                                <option value="user">User</option>
                                <option value="staff">Staff</option>
                                <option value="manager">Manager</option>
                                <option value="admin">Admin</option>
                                <option value="owner">Owner</option>
                            </select>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button onClick={handleCreate} disabled={!newUser.businessId.trim()} style={{ flex: 1, padding: '8px', background: '#10b981', color: 'white', border: 'none', opacity: newUser.businessId.trim() ? 1 : 0.5 }}>Create</button>
                                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '8px', background: '#ef4444', color: 'white', border: 'none' }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #374151' }}>
                        <th style={{ padding: '10px' }}>Name</th>
                        <th style={{ padding: '10px' }}>Email</th>
                        <th style={{ padding: '10px' }}>Role</th>
                        <th style={{ padding: '10px' }}>Status</th>
                        <th style={{ padding: '10px' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id} style={{ borderBottom: '1px solid #1f2937' }}>
                            <td style={{ padding: '10px' }}>{user.name || '-'}</td>
                            <td style={{ padding: '10px' }}>{user.email}</td>
                            <td style={{ padding: '10px' }}>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '12px', fontSize: '12px',
                                    background: user.role === 'admin' || user.role === 'owner' ? '#7c3aed' : '#374151'
                                }}>
                                    {user.role}
                                </span>
                            </td>
                            <td style={{ padding: '10px' }}>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '12px', marginRight: '4px',
                                    background: user.status === 'active' ? '#10b981' : '#ef4444',
                                    color: '#fff'
                                }}>
                                    {user.status || 'active'}
                                </span>
                                {user.isLocked && (
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                                        background: '#f59e0b', color: '#000'
                                    }}>
                                        🔒 Locked
                                    </span>
                                )}
                            </td>
                            <td style={{ padding: '10px' }}>
                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                    {user.status === 'active' ? (
                                        <ActionBtn
                                            label="Deactivate"
                                            color="#f59e0b"
                                            onClick={() => handleUserAction(user.id, 'deactivate')}
                                            disabled={actionLoading === user.id}
                                        />
                                    ) : (
                                        <ActionBtn
                                            label="Activate"
                                            color="#10b981"
                                            onClick={() => handleUserAction(user.id, 'activate')}
                                            disabled={actionLoading === user.id}
                                        />
                                    )}
                                    {user.isLocked ? (
                                        <ActionBtn
                                            label="Unlock"
                                            color="#3b82f6"
                                            onClick={() => handleUserAction(user.id, 'unlock')}
                                            disabled={actionLoading === user.id}
                                        />
                                    ) : (
                                        <ActionBtn
                                            label="Lock"
                                            color="#ef4444"
                                            onClick={() => handleUserAction(user.id, 'lock')}
                                            disabled={actionLoading === user.id}
                                        />
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

function ActionBtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: '4px 8px',
                fontSize: '11px',
                background: disabled ? '#4b5563' : color,
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1
            }}
        >
            {label}
        </button>
    );
}
