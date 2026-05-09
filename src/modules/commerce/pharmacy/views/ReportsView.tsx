export const ReportsView = () => {
    return (
        <div>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 24px' }}>Compliance & Reports</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {[
                    { title: 'Dangerous Drugs Register', date: 'Updated Today', status: 'Compliant' },
                    { title: 'Expiry Write-off Log', date: 'Last entry: 2 days ago', status: 'Review Needed' },
                    { title: 'Daily Sales Report', date: 'Auto-generated', status: 'Ready' },
                    { title: 'Shift Handover Log', date: 'Shift 1 -> Shift 2', status: 'Signed' }
                ].map((report, i) => (
                    <div key={i} style={{ background: 'white', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
                        <h3 style={{ margin: '0 0 8px', fontSize: '18px' }}>{report.title}</h3>
                        <div style={{ color: 'var(--fg-secondary)', fontSize: '14px', marginBottom: '16px' }}>{report.date}</div>
                        <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: '#f1f5f9' }}>{report.status}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
