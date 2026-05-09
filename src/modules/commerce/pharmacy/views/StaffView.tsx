export const StaffView = () => {
    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 24px' }}>Staff & Roles</h1>

            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                {[
                    { name: 'Sarah Jenkins', role: 'Licensed Pharmacist', status: 'On Duty', license: 'PH-8821' },
                    { name: 'Mike Ross', role: 'Assistant', status: 'On Duty', license: 'N/A' },
                    { name: 'Jessica Pearson', role: 'Owner', status: 'Off Duty', license: 'PH-1102' },
                ].map((person, i) => (
                    <div key={i} style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '16px' }}>{person.name}</div>
                            <div style={{ color: 'var(--fg-secondary)', fontSize: '14px' }}>{person.role} • <span style={{ fontFamily: 'monospace' }}>{person.license}</span></div>
                        </div>
                        <span style={{
                            fontSize: '13px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px',
                            background: person.status === 'On Duty' ? '#dcfce7' : '#f1f5f9',
                            color: person.status === 'On Duty' ? '#166534' : '#64748b'
                        }}>
                            {person.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
