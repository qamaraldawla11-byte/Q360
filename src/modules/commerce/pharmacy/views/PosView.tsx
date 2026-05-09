import { useState } from 'react';
import { usePharmacyStore } from '../store/pharmacy.store';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Search, Plus, Trash2, ShoppingCart, User, CreditCard } from 'lucide-react';
import type { Medicine } from '../store/pharmacy.types';

export const PosView = () => {
    const { inventory, dispense: processDispense } = usePharmacyStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [cart, setCart] = useState<{ item: Medicine; quantity: number }[]>([]);

    // Derived state
    const filteredInventory = inventory.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.genericName?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    const subtotal = cart.reduce((acc, curr) => acc + (curr.item.price * curr.quantity), 0);
    const tax = subtotal * 0.08;
    const total = subtotal + tax;

    // Handlers
    const addToCart = (item: Medicine) => {
        setCart(prev => {
            const existing = prev.find(p => p.item.id === item.id);
            if (existing) {
                return prev.map(p => p.item.id === item.id ? { ...p, quantity: p.quantity + 1 } : p);
            }
            return [...prev, { item, quantity: 1 }];
        });
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => prev.filter(p => p.item.id !== itemId));
    };

    const handleCheckout = () => {
        if (cart.length === 0) return;

        // Batch dispense
        const itemsToDispense = cart.map(c => ({
            medicineId: c.item.id,
            quantity: c.quantity
        }));

        processDispense(itemsToDispense);

        setCart([]);
        alert('Dispense Complete!');
    };

    return (
        <ModuleShell fullHeight padding="0">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', height: '100%' }}>

                {/* Left: Catalog */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', borderRight: '1px solid var(--border-subtle)', background: '#f8fafc' }}>
                    <PageHeader
                        title="Dispensing Terminal"
                        subtitle="Search and add medicines to the active script."
                    />

                    <div style={{ position: 'relative' }}>
                        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            className="input-base"
                            placeholder="Search medicines..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ width: '100%', paddingLeft: '48px', background: 'white' }}
                            autoFocus
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', overflowY: 'auto', paddingBottom: '20px' }}>
                        {filteredInventory.map(item => (
                            <div
                                key={item.id}
                                onClick={() => addToCart(item)}
                                style={{
                                    background: 'white', padding: '16px', borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border-subtle)', cursor: 'pointer',
                                    transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '8px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                            >
                                <div style={{ fontWeight: 600, fontSize: '15px' }}>{item.name}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{item.genericName}</div>
                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--fg-primary)' }}>${item.price}</span>
                                    <div style={{ width: '24px', height: '24px', background: '#f0f9ff', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                        <Plus size={16} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Cart */}
                <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', background: 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Current Order</h2>
                        <div style={{ width: '40px', height: '40px', background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShoppingCart size={20} color="var(--fg-secondary)" />
                        </div>
                    </div>

                    {/* Patient (Mock) */}
                    <div style={{ padding: '16px', background: '#f8fafc', borderRadius: 'var(--radius-md)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', background: '#cbd5e1', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={16} color="white" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '14px' }}>Walk-in Patient</div>
                            <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>New Visit</div>
                        </div>
                    </div>

                    {/* Items */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                        {cart.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--fg-muted)', marginTop: '40px' }}>
                                Cart is empty
                            </div>
                        ) : (
                            cart.map(({ item, quantity }) => (
                                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>${item.price} x {quantity}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontWeight: 600 }}>${(item.price * quantity).toFixed(2)}</span>
                                        <button onClick={() => removeFromCart(item.id)} style={{ padding: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Totals */}
                    <div style={{ borderTop: '2px dashed var(--border-subtle)', paddingTop: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--fg-secondary)' }}>
                            <span>Subtotal</span>
                            <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '14px', color: 'var(--fg-secondary)' }}>
                            <span>Tax (8%)</span>
                            <span>${tax.toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', fontSize: '20px', fontWeight: 800 }}>
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0}
                            style={{
                                width: '100%', padding: '16px', borderRadius: 'var(--radius-lg)',
                                background: cart.length === 0 ? '#cbd5e1' : 'var(--accent-primary)',
                                color: 'white', border: 'none', fontWeight: 700, fontSize: '16px',
                                cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                            }}
                        >
                            <CreditCard size={20} /> Collect Payment
                        </button>
                    </div>
                </div>
            </div>
        </ModuleShell>
    );
};
