import { useState } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Scan, Plus, Minus, ShoppingCart } from 'lucide-react';
import { useSupermarketStore } from '../store/supermarket.store';
import { ordersService } from '@/core/services/orders.service';

export const PosView = () => {
    const [barcode, setBarcode] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { cart, addToCart, updateQuantity, clearCart } = useSupermarketStore();

    const handleBarcodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!barcode.trim()) return;

        const product = await ordersService.findProduct(barcode);
        if (product) {
            addToCart({
                id: product.id,
                name: product.name,
                price: product.price
            });
            setBarcode(''); // Clear on success
        } else {
            alert('Product not found! (Try: 123456, 234567, 345678, 456789, 567890)');
        }
    };

    const handleProcessPayment = async () => {
        if (isProcessing) return; // Prevent double-tap
        setIsProcessing(true);
        try {
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0) * 1.1; // +tax
            await ordersService.processSale(cart);
            alert(`Payment processed: $${total.toFixed(2)}`);
        } catch (error) {
            console.error('Payment failed:', error);
            alert('Payment failed. Please try again.');
        } finally {
            setIsProcessing(false);
        }
    };

    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.1;
    const total = subtotal + tax;

    return (
        <ModuleShell>
            <PageHeader
                title="Barcode POS"
                subtitle="Scan products and process sales"
            />

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                {/* Barcode Scanner */}
                <div>
                    <div style={{
                        background: 'var(--surface-100)',
                        borderRadius: '16px',
                        border: '1px solid var(--surface-400)',
                        padding: '24px',
                        marginBottom: '20px'
                    }}>
                        <form onSubmit={handleBarcodeSubmit}>
                            <label style={{ display: 'block', marginBottom: '12px', fontWeight: 600, fontSize: '14px' }}>
                                Scan Barcode
                            </label>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <Scan size={20} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                                    <input
                                        type="text"
                                        value={barcode}
                                        onChange={(e) => setBarcode(e.target.value)}
                                        placeholder="Enter or scan barcode..."
                                        autoFocus
                                        style={{
                                            width: '100%',
                                            padding: '14px 14px 14px 44px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--surface-400)',
                                            fontSize: '16px',
                                            outline: 'none',
                                            background: 'var(--surface-100)',
                                            color: 'var(--fg-primary)'
                                        }}
                                    />
                                </div>
                                <button type="submit" style={{
                                    padding: '0 32px',
                                    background: 'var(--accent)',
                                    color: 'var(--fg-on-primary)',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}>
                                    Add
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Cart Items */}
                    <div style={{
                        background: 'var(--surface-100)',
                        borderRadius: '16px',
                        border: '1px solid var(--surface-400)',
                        overflow: 'hidden'
                    }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--surface-400)' }}>
                            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Cart ({cart.length} items)</h3>
                        </div>
                        <div style={{ padding: '20px' }}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--fg-secondary)' }}>
                                    <ShoppingCart size={48} style={{ marginBottom: '16px', opacity: 0.5, margin: '0 auto 16px' }} />
                                    <p>Scan products to add them to the cart</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {cart.map((item) => (
                                        <div key={item.id} style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '12px',
                                            background: 'var(--surface-200)',
                                            borderRadius: '10px',
                                            border: '1px solid var(--surface-400)'
                                        }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>{item.name}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--fg-secondary)' }}>
                                                    ${item.price.toFixed(2)} ea
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--surface-100)', borderRadius: '8px', border: '1px solid var(--surface-400)', padding: '4px' }}>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, -1)}
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: 'var(--surface-200)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'var(--fg-primary)'
                                                        }}
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <span style={{ fontWeight: 700, minWidth: '24px', textAlign: 'center', color: 'var(--fg-primary)' }}>
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        onClick={() => updateQuantity(item.id, 1)}
                                                        style={{
                                                            width: '28px',
                                                            height: '28px',
                                                            borderRadius: '6px',
                                                            border: 'none',
                                                            background: 'var(--surface-200)',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            color: 'var(--fg-primary)'
                                                        }}
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: '16px', minWidth: '80px', textAlign: 'right', color: 'var(--fg-primary)' }}>
                                                    ${(item.price * item.quantity).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Checkout Summary */}
                <div>
                    <div style={{
                        background: 'var(--surface-100)',
                        borderRadius: '16px',
                        border: '1px solid var(--surface-400)',
                        padding: '24px',
                        position: 'sticky',
                        top: '24px'
                    }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '24px', margin: '0 0 24px' }}>Order Summary</h3>

                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--fg-secondary)' }}>Subtotal</span>
                                <span style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>${subtotal.toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px' }}>
                                <span style={{ color: 'var(--fg-secondary)' }}>Tax (10%)</span>
                                <span style={{ fontWeight: 600, color: 'var(--fg-primary)' }}>${tax.toFixed(2)}</span>
                            </div>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingTop: '16px',
                                borderTop: '2px solid var(--surface-400)',
                                fontSize: '20px',
                                fontWeight: 700,
                                marginTop: '16px'
                            }}>
                                <span style={{ color: 'var(--fg-primary)' }}>Total</span>
                                <span style={{ color: 'var(--accent)' }}>${total.toFixed(2)}</span>
                            </div>
                        </div>

                        <button
                            disabled={cart.length === 0 || isProcessing}
                            onClick={handleProcessPayment}
                            style={{
                                width: '100%',
                                padding: '16px',
                                background: (cart.length > 0 && !isProcessing) ? 'var(--accent)' : 'var(--surface-500)',
                                color: 'var(--fg-on-primary)',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: 700,
                                cursor: (cart.length > 0 && !isProcessing) ? 'pointer' : 'not-allowed',
                                marginBottom: '12px',
                                opacity: isProcessing ? 0.7 : 1
                            }}
                        >
                            {isProcessing ? 'Processing...' : 'Process Payment'}
                        </button>

                        <button
                            onClick={() => clearCart()}
                            style={{
                                width: '100%',
                                padding: '12px',
                                background: 'transparent',
                                border: '1px solid var(--surface-400)',
                                borderRadius: '12px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: 'var(--fg-secondary)'
                            }}
                        >
                            Clear Cart
                        </button>
                    </div>
                </div>
            </div>
        </ModuleShell>
    );
};
