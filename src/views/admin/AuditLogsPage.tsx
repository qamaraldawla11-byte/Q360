import { useCallback, useEffect, useState } from 'react';
import { adminApi, type AdminLog, type AuditLogFilters } from '@/api/admin.api';

export const AuditLogsPage = () => {
    const [logs, setLogs] = useState<AdminLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    const [filters, setFilters] = useState<AuditLogFilters>({});

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const data = await adminApi.getAuditLogs(filters);
            setLogs(data);
        } catch (err) {
            console.error('Failed to fetch logs:', err);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleFilter = () => {
        fetchLogs();
    };

    const clearFilters = () => {
        setFilters({});
        setTimeout(() => fetchLogs(), 0);
    };

    return (
        <div>
            <h2>System Audit Logs</h2>

            {/* Filter Controls */}
            <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '10px',
                marginTop: '20px', marginBottom: '20px',
                padding: '15px', background: '#1f2937', borderRadius: '8px'
            }}>
                <input
                    placeholder="User ID"
                    value={filters.userId || ''}
                    onChange={e => setFilters({ ...filters, userId: e.target.value || undefined })}
                    style={{ padding: '8px', flex: '1', minWidth: '120px' }}
                />
                <input
                    placeholder="Business ID"
                    value={filters.businessId || ''}
                    onChange={e => setFilters({ ...filters, businessId: e.target.value || undefined })}
                    style={{ padding: '8px', flex: '1', minWidth: '120px' }}
                />
                <select
                    value={filters.action || ''}
                    onChange={e => setFilters({ ...filters, action: e.target.value || undefined })}
                    style={{ padding: '8px', minWidth: '140px' }}
                >
                    <option value="">All Actions</option>
                    <option value="CREATE">CREATE</option>
                    <option value="UPDATE">UPDATE</option>
                    <option value="DELETE">DELETE</option>
                    <option value="ACTIVATE_USER">ACTIVATE_USER</option>
                    <option value="DEACTIVATE_USER">DEACTIVATE_USER</option>
                    <option value="LOCK_USER">LOCK_USER</option>
                    <option value="UNLOCK_USER">UNLOCK_USER</option>
                    <option value="SUSPEND_BUSINESS">SUSPEND_BUSINESS</option>
                    <option value="ACTIVATE_BUSINESS">ACTIVATE_BUSINESS</option>
                    <option value="UPDATE_SETTING">UPDATE_SETTING</option>
                </select>
                <input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={e => setFilters({ ...filters, startDate: e.target.value || undefined })}
                    style={{ padding: '8px' }}
                    placeholder="Start Date"
                />
                <input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={e => setFilters({ ...filters, endDate: e.target.value || undefined })}
                    style={{ padding: '8px' }}
                    placeholder="End Date"
                />
                <button
                    onClick={handleFilter}
                    style={{ padding: '8px 16px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    Apply Filters
                </button>
                <button
                    onClick={clearFilters}
                    style={{ padding: '8px 16px', background: '#6b7280', color: 'white', border: 'none', borderRadius: '4px' }}
                >
                    Clear
                </button>
            </div>

            {loading && <div>Loading logs...</div>}

            {!loading && (
                <div style={{ height: '70vh', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                        <thead style={{ position: 'sticky', top: 0, background: '#111827' }}>
                            <tr style={{ borderBottom: '1px solid #374151' }}>
                                <th style={{ padding: '10px', width: '30px' }}></th>
                                <th style={{ padding: '10px' }}>Timestamp</th>
                                <th style={{ padding: '10px' }}>Action</th>
                                <th style={{ padding: '10px' }}>Entity</th>
                                <th style={{ padding: '10px' }}>User ID</th>
                                <th style={{ padding: '10px' }}>Business ID</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <>
                                    <tr
                                        key={log.id}
                                        style={{ borderBottom: '1px solid #1f2937', cursor: 'pointer' }}
                                        onClick={() => setExpandedRow(expandedRow === log.id ? null : log.id)}
                                    >
                                        <td style={{ padding: '10px' }}>
                                            {expandedRow === log.id ? '▼' : '▶'}
                                        </td>
                                        <td style={{ padding: '10px' }}>{new Date(log.timestamp).toLocaleString()}</td>
                                        <td style={{ padding: '10px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '4px', fontSize: '12px',
                                                background: getActionColor(log.action), color: '#fff'
                                            }}>
                                                {log.action}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px' }}>{log.entity}</td>
                                        <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                                            {log.userId?.slice(0, 8)}...
                                        </td>
                                        <td style={{ padding: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
                                            {log.businessId?.slice(0, 8)}...
                                        </td>
                                    </tr>
                                    {expandedRow === log.id && (
                                        <tr key={`${log.id}-details`} style={{ background: '#0f172a' }}>
                                            <td colSpan={6} style={{ padding: '15px' }}>
                                                <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                                    <strong>Entity ID:</strong> {log.entityId || 'N/A'}<br />
                                                    <strong>Full User ID:</strong> {log.userId}<br />
                                                    <strong>Full Business ID:</strong> {log.businessId}<br />
                                                    <strong>Details:</strong>
                                                    <pre style={{
                                                        marginTop: '8px', padding: '10px',
                                                        background: '#1e293b', borderRadius: '4px',
                                                        overflow: 'auto', maxHeight: '200px'
                                                    }}>
                                                        {typeof log.details === 'string'
                                                            ? JSON.stringify(JSON.parse(log.details), null, 2)
                                                            : JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                        </tbody>
                    </table>
                    {logs.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>
                            No logs found matching the filters.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

function getActionColor(action: string): string {
    const colors: Record<string, string> = {
        'CREATE': '#10b981',
        'UPDATE': '#3b82f6',
        'DELETE': '#ef4444',
        'ACTIVATE_USER': '#10b981',
        'DEACTIVATE_USER': '#f59e0b',
        'LOCK_USER': '#ef4444',
        'UNLOCK_USER': '#10b981',
        'SUSPEND_BUSINESS': '#ef4444',
        'ACTIVATE_BUSINESS': '#10b981',
        'UPDATE_SETTING': '#8b5cf6',
    };
    return colors[action] || '#6b7280';
}
