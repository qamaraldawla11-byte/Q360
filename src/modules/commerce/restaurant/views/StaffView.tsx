export const StaffView = () => {
    const staff = [
        { id: 1, name: 'Alice Walker', role: 'Manager', shift: 'Morning', status: 'Active' },
        { id: 2, name: 'Bob Smith', role: 'Head Chef', shift: 'Full Day', status: 'Active' },
        { id: 3, name: 'Charlie Brown', role: 'Server', shift: 'Evening', status: 'Active' },
        { id: 4, name: 'Dana White', role: 'Server', shift: 'Evening', status: 'Break' },
        { id: 5, name: 'Eddie Jones', role: 'Kitchen Porter', shift: 'Evening', status: 'Active' },
    ];

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>Staff preview</h1>
            <p style={{ margin: '0 0 16px', color: 'var(--fg-secondary)' }}>
                Preview-only sample data. Staff records, shifts, and payroll are not production-ready yet.
            </p>
            <div style={{ marginBottom: 20, padding: 16, border: '1px solid #fed7aa', borderRadius: 8, background: '#fff7ed', color: '#9a3412', fontWeight: 700 }}>
                Coming soon: these cards are static examples and are not connected to saved Restaurant staff.
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                {staff.map(person => (
                    <div key={person.id} style={{
                        width: '280px', background: 'white', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)',
                        display: 'flex', flexDirection: 'column', gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600 }}>
                                {person.name.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div style={{
                                padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                                background: person.status === 'Active' ? '#dcfce7' : '#fef9c3',
                                color: person.status === 'Active' ? '#166534' : '#854d0e'
                            }}>
                                {person.status}
                            </div>
                        </div>

                        <div>
                            <div style={{ fontWeight: 700, fontSize: '18px' }}>{person.name}</div>
                            <div style={{ color: 'var(--fg-secondary)', fontSize: '14px' }}>{person.role}</div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--fg-secondary)', marginTop: 'auto' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6' }} />
                            Shift: {person.shift}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
