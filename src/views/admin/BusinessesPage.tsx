import { useEffect, useState } from 'react';
import { adminApi, type AdminBusiness } from '@/api/admin.api';

export const BusinessesPage = () => {
    const [businesses, setBusinesses] = useState<AdminBusiness[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showSuspendModal, setShowSuspendModal] = useState<string | null>(null);
    const [suspendReason, setSuspendReason] = useState('');
    const [newBiz, setNewBiz] = useState({ name: '', type: 'retail' });
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchBiz = async () => {
        try {
            setLoading(true);
            const data = await adminApi.getBusinesses();
            setBusinesses(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBiz();
    }, []);

    const handleCreate = async () => {
        try {
            await adminApi.createBusiness(newBiz);
            setShowModal(false);
            setNewBiz({ name: '', type: 'retail' });
            fetchBiz();
        } catch {
            alert('Failed to create business');
        }
    };

    const handleSuspend = async () => {
        if (!showSuspendModal) return;
        setActionLoading(showSuspendModal);
        try {
            await adminApi.suspendBusiness(showSuspendModal, suspendReason || 'No reason provided');
            setShowSuspendModal(null);
            setSuspendReason('');
            fetchBiz();
        } catch {
            alert('Failed to suspend business');
        } finally {
            setActionLoading(null);
        }
    };

    const handleActivate = async (id: string) => {
        setActionLoading(id);
        try {
            await adminApi.activateBusiness(id);
            fetchBiz();
        } catch {
            alert('Failed to activate business');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2>Businesses (Multi-Tenancy)</h2>
                <button
                    onClick={() => setShowModal(true)}
                    style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    + Add Business
                </button>
            </div>

            {/* Create Business Modal */}
            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px', minWidth: '400px' }}>
                        <h3>Add New Business</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
                            <input
                                placeholder="Business Name"
                                value={newBiz.name}
                                onChange={e => setNewBiz({ ...newBiz, name: e.target.value })}
                                style={{ padding: '8px' }}
                            />
                            <select
                                value={newBiz.type}
                                onChange={e => setNewBiz({ ...newBiz, type: e.target.value })}
                                style={{ padding: '8px' }}
                            >
                                <option value="retail">Retail</option>
                                <option value="service">Service</option>
                                <option value="fnb">Food & Beverage</option>
                            </select>
                            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                                <button onClick={handleCreate} style={{ flex: 1, padding: '8px', background: '#10b981', color: 'white', border: 'none' }}>Create</button>
                                <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '8px', background: '#ef4444', color: 'white', border: 'none' }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Suspend Business Modal */}
            {showSuspendModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ background: '#1f2937', padding: '20px', borderRadius: '8px', minWidth: '400px' }}>
                        <h3>Suspend Business</h3>
                        <p style={{ color: '#9ca3af', fontSize: '14px', margin: '10px 0' }}>
                            Please provide a reason for suspending this business:
                        </p>
                        <textarea
                            placeholder="Suspension reason..."
                            value={suspendReason}
                            onChange={e => setSuspendReason(e.target.value)}
                            style={{ width: '100%', padding: '8px', minHeight: '80px', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                            <button
                                onClick={handleSuspend}
                                disabled={actionLoading === showSuspendModal}
                                style={{ flex: 1, padding: '8px', background: '#ef4444', color: 'white', border: 'none' }}
                            >
                                Suspend
                            </button>
                            <button
                                onClick={() => { setShowSuspendModal(null); setSuspendReason(''); }}
                                style={{ flex: 1, padding: '8px', background: '#6b7280', color: 'white', border: 'none' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #374151' }}>
                        <th style={{ padding: '10px' }}>ID</th>
                        <th style={{ padding: '10px' }}>Name</th>
                        <th style={{ padding: '10px' }}>Type</th>
                        <th style={{ padding: '10px' }}>Status</th>
                        <th style={{ padding: '10px' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {businesses.map(biz => (
                        <tr key={biz.id} style={{ borderBottom: '1px solid #1f2937' }}>
                            <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>{biz.id.slice(0, 8)}...</td>
                            <td style={{ padding: '10px' }}>{biz.name}</td>
                            <td style={{ padding: '10px' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '12px', background: '#374151' }}>
                                    {biz.type}
                                </span>
                            </td>
                            <td style={{ padding: '10px' }}>
                                <span style={{
                                    padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                                    background: biz.status === 'active' ? '#10b981' : '#ef4444',
                                    color: '#fff'
                                }}>
                                    {biz.status}
                                </span>
                                {biz.suspensionReason && (
                                    <span
                                        title={biz.suspensionReason}
                                        style={{ marginLeft: '8px', cursor: 'help', fontSize: '12px', color: '#9ca3af' }}
                                    >
                                        ℹ️
                                    </span>
                                )}
                            </td>
                            <td style={{ padding: '10px' }}>
                                {biz.status === 'active' ? (
                                    <button
                                        onClick={() => setShowSuspendModal(biz.id)}
                                        disabled={actionLoading === biz.id}
                                        style={{
                                            padding: '4px 8px', fontSize: '11px',
                                            background: actionLoading === biz.id ? '#4b5563' : '#ef4444',
                                            color: '#fff', border: 'none', borderRadius: '4px'
                                        }}
                                    >
                                        Suspend
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleActivate(biz.id)}
                                        disabled={actionLoading === biz.id}
                                        style={{
                                            padding: '4px 8px', fontSize: '11px',
                                            background: actionLoading === biz.id ? '#4b5563' : '#10b981',
                                            color: '#fff', border: 'none', borderRadius: '4px'
                                        }}
                                    >
                                        Activate
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
