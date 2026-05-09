import { useState } from 'react';
import { usePharmacyStore } from '../store/pharmacy.store';
import { Plus, User, FileText, CheckCircle2 } from 'lucide-react';
import type { RxStatus } from '../store/pharmacy.types';

export const PrescriptionView = () => {
    const { prescriptions, addPrescription, updateRxStatus } = usePharmacyStore();
    const [showNew, setShowNew] = useState(false);

    // New RX Form State
    const [patient, setPatient] = useState('');
    const [doctor, setDoctor] = useState('');
    const [medName, setMedName] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        addPrescription({
            patientName: patient,
            doctorName: doctor,
            items: [{ medicineId: 'mock-id', medicineName: medName, dosage: '1 tab daily', quantity: 30 }]
        });
        setShowNew(false);
        setPatient('');
        setDoctor('');
        setMedName('');
    };

    const StatusBadge = ({ status }: { status: RxStatus }) => {
        const colors = {
            pending: { bg: '#fff7ed', text: '#9a3412', border: '#ffedd5' },
            dispensed: { bg: '#ecfdf5', text: '#065f46', border: '#d1fae5' },
            cancelled: { bg: '#fef2f2', text: '#991b1b', border: '#fee2e2' }
        };
        const c = colors[status];
        return (
            <span style={{
                padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase',
                background: c.bg, color: c.text, border: `1px solid ${c.border}`
            }}>
                {status}
            </span>
        );
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>Prescription Management</h1>
                <button
                    onClick={() => setShowNew(true)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
                        background: 'var(--accent-primary)', color: 'white', border: 'none',
                        borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer'
                    }}
                >
                    <Plus size={18} /> New Prescription
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                {/* New Form Overlay Mock */}
                {showNew && (
                    <div style={{ gridColumn: '1 / -1', background: 'white', padding: '24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--accent-primary)', marginBottom: '24px' }}>
                        <h3 style={{ marginTop: 0 }}>Enter New Prescription</h3>
                        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px', maxWidth: '400px' }}>
                            <input required placeholder="Patient Name" value={patient} onChange={e => setPatient(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
                            <input required placeholder="Doctor Name" value={doctor} onChange={e => setDoctor(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
                            <input required placeholder="Medicine & Dosage" value={medName} onChange={e => setMedName(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" style={{ padding: '10px 20px', background: 'var(--accent-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Create RX</button>
                                <button type="button" onClick={() => setShowNew(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                            </div>
                        </form>
                    </div>
                )}

                {prescriptions.map(rx => (
                    <div key={rx.id} style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: '15px' }}>Rx #{rx.id.slice(-6)}</div>
                            <StatusBadge status={rx.status} />
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                                <User size={16} color="var(--fg-secondary)" />
                                <span style={{ fontWeight: 600 }}>{rx.patientName}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', color: 'var(--fg-secondary)', fontSize: '14px' }}>
                                <FileText size={16} />
                                <span>Prescribed by {rx.doctorName}</span>
                            </div>

                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px' }}>
                                {rx.items.map((item, idx) => (
                                    <div key={idx} style={{ marginBottom: idx === rx.items.length - 1 ? 0 : '8px' }}>
                                        <strong>{item.medicineName}</strong>
                                        <div style={{ color: 'var(--fg-secondary)', fontSize: '13px' }}>{item.dosage} • Qty: {item.quantity}</div>
                                    </div>
                                ))}
                            </div>

                            {rx.status === 'pending' && (
                                <button
                                    onClick={() => updateRxStatus(rx.id, 'dispensed')}
                                    style={{
                                        width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: 'none',
                                        background: 'var(--accent-primary)', color: 'white', fontWeight: 600, cursor: 'pointer',
                                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    <CheckCircle2 size={18} /> Mark Dispensed
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
