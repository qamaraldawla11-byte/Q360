import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertTriangle, Check, Package, Pencil, Plus, Save, ShoppingCart, Truck, X } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { inventoryApi, type InventoryItem, type PurchaseOrder, type Supplier } from '@/api/inventory.api';

type Tab = 'Stock' | 'Suppliers' | 'Purchasing';
const emptySupplier = { name: '', contact: '', phone: '', email: '', address: '' };
const supplierCode = (id: string) => `QSUP-${id.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase()}`;

export const InventoryView = () => {
    const [tab, setTab] = useState<Tab>('Stock');
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState('');
    const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
    const [itemForm, setItemForm] = useState({ name: '', current: '0', min: '0', unit: 'kg', category: '', price: '0' });
    const [supplierForm, setSupplierForm] = useState(emptySupplier);
    const [poForm, setPoForm] = useState({ itemId: '', supplierId: '', quantity: '1', unitCost: '0' });

    const load = useCallback(async () => {
        try {
            const [nextItems, nextSuppliers, nextOrders] = await Promise.all([inventoryApi.items(), inventoryApi.suppliers(), inventoryApi.purchaseOrders()]);
            setItems(nextItems); setSuppliers(nextSuppliers); setOrders(nextOrders); setError('');
        } catch { setError('Unable to load inventory data.'); }
    }, []);
    useEffect(() => { void load(); }, [load]);
    const low = useMemo(() => items.filter(item => item.status !== 'ok'), [items]);
    const showMessage = (text: string) => { setMessage(text); setError(''); };

    const submitItem = async (event: FormEvent) => {
        event.preventDefault(); setBusy('item');
        try {
            await inventoryApi.createItem({ name: itemForm.name, current: Number(itemForm.current), min: Number(itemForm.min), unit: itemForm.unit, category: itemForm.category || undefined, price: Number(itemForm.price) });
            setItemForm({ name: '', current: '0', min: '0', unit: 'kg', category: '', price: '0' }); await load(); showMessage('Stock item added.');
        } catch { setError('Unable to create inventory item.'); } finally { setBusy(''); }
    };
    const submitSupplier = async (event: FormEvent) => {
        event.preventDefault(); setBusy('supplier');
        try {
            if (editingSupplierId) await inventoryApi.updateSupplier(editingSupplierId, supplierForm);
            else await inventoryApi.createSupplier(supplierForm);
            const action = editingSupplierId ? 'updated' : 'added';
            setEditingSupplierId(null); setSupplierForm(emptySupplier); await load(); showMessage(`Supplier ${action}.`);
        } catch { setError(`Unable to ${editingSupplierId ? 'update' : 'create'} supplier.`); } finally { setBusy(''); }
    };
    const editSupplier = (supplier: Supplier) => {
        setEditingSupplierId(supplier.id);
        setSupplierForm({ name: supplier.name, contact: supplier.contact || '', phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const cancelSupplierEdit = () => { setEditingSupplierId(null); setSupplierForm(emptySupplier); };
    const submitPo = async (event: FormEvent) => {
        event.preventDefault(); setBusy('purchase');
        try {
            await inventoryApi.createPurchaseOrder({ itemId: poForm.itemId, supplierId: poForm.supplierId || undefined, quantity: Number(poForm.quantity), unitCost: Number(poForm.unitCost) });
            setPoForm(current => ({ ...current, quantity: '1', unitCost: '0' })); await load(); showMessage('Purchase order created. Stock changes only after receiving.');
        } catch { setError('Unable to create purchase order.'); } finally { setBusy(''); }
    };
    const receive = async (order: PurchaseOrder) => {
        setBusy(order.id);
        try { await inventoryApi.receivePurchaseOrder(order.id); await load(); showMessage('Purchase received and stock updated.'); }
        catch { setError('Unable to receive this purchase order. It may already be received.'); }
        finally { setBusy(''); }
    };

    return <ModuleShell><PageHeader title="Stock" subtitle="Saved stock, suppliers, purchase orders, and receiving for this business." />
        {error && <div className="inv-alert error">{error}</div>}{message && <div className="inv-alert success"><Check size={16} />{message}</div>}
        <div className="inv-stats"><article><Package /><b>{items.length}</b><span>Stock items</span></article><article><AlertTriangle /><b>{low.length}</b><span>Low stock</span></article><article><ShoppingCart /><b>{orders.filter(order => order.status === 'ordered').length}</b><span>Open purchases</span></article></div>
        <div className="inv-tabs">{(['Stock', 'Suppliers', 'Purchasing'] as Tab[]).map(value => <button type="button" className={tab === value ? 'active' : ''} onClick={() => setTab(value)} key={value}>{value}</button>)}</div>

        {tab === 'Stock' && <><form className="inv-form stock-form" onSubmit={submitItem}>
            <label>Item name<input required placeholder="e.g. Rice" value={itemForm.name} onChange={event => setItemForm({ ...itemForm, name: event.target.value })} /></label>
            <label>Starting quantity<input required type="number" min="0" step="any" value={itemForm.current} onChange={event => setItemForm({ ...itemForm, current: event.target.value })} /></label>
            <label>Low-stock alert<input required type="number" min="0" step="any" value={itemForm.min} onChange={event => setItemForm({ ...itemForm, min: event.target.value })} /></label>
            <label>Unit<input required placeholder="kg, pcs, litres" value={itemForm.unit} onChange={event => setItemForm({ ...itemForm, unit: event.target.value })} /></label>
            <label>Unit cost<input type="number" min="0" step="any" value={itemForm.price} onChange={event => setItemForm({ ...itemForm, price: event.target.value })} /></label>
            <label>Category <span>(optional)</span><input placeholder="Dry goods" value={itemForm.category} onChange={event => setItemForm({ ...itemForm, category: event.target.value })} /></label>
            <button disabled={busy === 'item'}><Plus size={16} />{busy === 'item' ? 'Adding…' : 'Add item'}</button>
        </form><div className="inv-table"><table><thead><tr><th>Item</th><th>Quantity on hand</th><th>Low-stock alert</th><th>Status</th><th>Adjustment</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><b>{item.name}</b><small>{item.category || 'Uncategorized'}</small></td><td>{item.current} {item.unit}</td><td>{item.min} {item.unit}</td><td><span className={`status ${item.status}`}>{item.status}</span></td><td><button type="button" onClick={async () => { const value = prompt('Enter quantity change. Use a negative number to reduce stock.'); if (value && Number.isFinite(Number(value))) { await inventoryApi.adjust(item.id, Number(value), 'manual_adjustment'); await load(); showMessage('Stock adjusted.'); } }}>Adjust stock</button></td></tr>)}</tbody></table></div></>}

        {tab === 'Suppliers' && <><form className="inv-form supplier-form" onSubmit={submitSupplier}>
            <div className="inv-form-heading"><div><b>{editingSupplierId ? 'Edit supplier' : 'Add supplier'}</b><span>{editingSupplierId ? `Q360 Supplier ID: ${supplierCode(editingSupplierId)}` : 'Create a supplier record for purchasing.'}</span></div>{editingSupplierId && <button type="button" className="icon-button" onClick={cancelSupplierEdit} aria-label="Cancel supplier edit"><X size={17} /></button>}</div>
            <label>Supplier name<input required value={supplierForm.name} onChange={event => setSupplierForm({ ...supplierForm, name: event.target.value })} /></label>
            <label>Contact person<input value={supplierForm.contact} onChange={event => setSupplierForm({ ...supplierForm, contact: event.target.value })} /></label>
            <label>Phone<input type="tel" value={supplierForm.phone} onChange={event => setSupplierForm({ ...supplierForm, phone: event.target.value })} /></label>
            <label>Email<input type="email" value={supplierForm.email} onChange={event => setSupplierForm({ ...supplierForm, email: event.target.value })} /></label>
            <label>Address<input value={supplierForm.address} onChange={event => setSupplierForm({ ...supplierForm, address: event.target.value })} /></label>
            <button disabled={busy === 'supplier'}>{editingSupplierId ? <Save size={16} /> : <Plus size={16} />}{busy === 'supplier' ? 'Saving…' : editingSupplierId ? 'Save supplier' : 'Add supplier'}</button>
        </form><div className="inv-cards">{suppliers.map(supplier => <article key={supplier.id}><Truck /><div className="supplier-details"><b>{supplier.name}</b><code>{supplierCode(supplier.id)}</code><span>{supplier.contact || 'No contact person'}</span><span>{[supplier.phone, supplier.email].filter(Boolean).join(' · ') || 'No phone or email'}</span>{supplier.address && <span>{supplier.address}</span>}</div><button type="button" onClick={() => editSupplier(supplier)}><Pencil size={15} /> Edit</button></article>)}</div></>}

        {tab === 'Purchasing' && <><form className="inv-form purchase-form" onSubmit={submitPo}>
            <label>Inventory item<select required value={poForm.itemId} onChange={event => setPoForm({ ...poForm, itemId: event.target.value })}><option value="">Select item</option>{items.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Supplier<select value={poForm.supplierId} onChange={event => setPoForm({ ...poForm, supplierId: event.target.value })}><option value="">No supplier</option>{suppliers.map(supplier => <option value={supplier.id} key={supplier.id}>{supplier.name}</option>)}</select></label>
            <label>Order quantity<input required type="number" min="0.01" step="any" value={poForm.quantity} onChange={event => setPoForm({ ...poForm, quantity: event.target.value })} /></label>
            <label>Cost per unit<input required type="number" min="0" step="any" value={poForm.unitCost} onChange={event => setPoForm({ ...poForm, unitCost: event.target.value })} /></label>
            <button disabled={busy === 'purchase' || !items.length}><ShoppingCart size={16} />{busy === 'purchase' ? 'Creating…' : 'Create PO'}</button>
        </form><div className="inv-table"><table><thead><tr><th>Item</th><th>Supplier</th><th>Quantity</th><th>Total cost</th><th>Status</th><th>Action</th></tr></thead><tbody>{orders.map(order => <tr key={order.id}><td>{items.find(item => item.id === order.inventoryItemId)?.name || 'Item'}</td><td>{suppliers.find(supplier => supplier.id === order.supplierId)?.name || 'No supplier'}</td><td>{order.quantity}</td><td>${(order.quantity * order.unitCost).toFixed(2)}</td><td><span className={`purchase-status ${order.status}`}>{order.status}</span></td><td>{order.status === 'ordered' ? <button type="button" disabled={busy === order.id} onClick={() => void receive(order)}>{busy === order.id ? 'Receiving…' : 'Receive stock'}</button> : 'Received'}</td></tr>)}</tbody></table></div></>}
        <style>{`
        .inv-alert{display:flex;align-items:center;gap:7px;padding:12px;margin-bottom:14px;border-radius:8px}.inv-alert.error{background:#fef2f2;color:#b91c1c}.inv-alert.success{background:#ecfdf5;color:#047857}.inv-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:20px}.inv-stats article{display:grid;grid-template-columns:40px 1fr;align-items:center;padding:16px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:12px}.inv-stats svg{grid-row:1/3;color:#f97316}.inv-stats b{font-size:24px}.inv-stats span{color:#64748b;font-size:12px}.inv-tabs{display:flex;gap:8px;margin-bottom:16px}.inv-tabs button{padding:9px 15px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#475569;font-weight:700}.inv-tabs .active{background:#f97316;color:#fff;border-color:#f97316}.inv-form{display:grid;grid-template-columns:repeat(6,minmax(110px,1fr));gap:10px;padding:16px;margin-bottom:16px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:12px}.inv-form label{display:flex;flex-direction:column;gap:6px;color:#334155;font-size:12px;font-weight:800}.inv-form label>span{font-weight:500;color:#64748b}.inv-form input,.inv-form select{min-width:0;min-height:42px;padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a}.inv-form>button,.inv-table button,.inv-cards article>button{min-height:40px;padding:8px 12px;display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:8px;background:#f97316;color:#fff;font-weight:700}.inv-form>button{align-self:end}.inv-form-heading{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between}.inv-form-heading b,.inv-form-heading span{display:block}.inv-form-heading span{margin-top:3px;color:#64748b;font-size:12px}.inv-form-heading .icon-button{min-height:34px;background:#fff;color:#475569;border:1px solid #cbd5e1}.supplier-form{grid-template-columns:repeat(5,minmax(120px,1fr))}.purchase-form{grid-template-columns:repeat(5,minmax(130px,1fr))}.inv-table{overflow:auto;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:12px}.inv-table table{width:100%;border-collapse:collapse;min-width:760px}.inv-table th,.inv-table td{padding:13px;text-align:left;color:#0f172a;border-bottom:1px solid #e2e8f0}.inv-table th{background:#f8fafc;color:#334155;font-size:12px}.inv-table small,.inv-cards span{display:block;color:#64748b;font-size:12px}.status,.purchase-status{padding:4px 8px;border-radius:99px;text-transform:capitalize}.status.ok,.purchase-status.received{background:#dcfce7;color:#166534}.status.low,.purchase-status.ordered{background:#fef3c7;color:#92400e}.status.critical,.purchase-status.cancelled{background:#fee2e2;color:#991b1b}.inv-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}.inv-cards article{display:grid;grid-template-columns:34px 1fr auto;gap:12px;align-items:start;padding:18px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:12px}.inv-cards>article>svg{color:#f97316}.supplier-details code{display:block;width:max-content;margin:5px 0;padding:3px 6px;border-radius:5px;background:#fff7ed;color:#9a3412;font-size:10px}.inv-cards article>button{min-height:34px;background:#fff;color:#475569;border:1px solid #cbd5e1}@media(max-width:1000px){.inv-form,.supplier-form,.purchase-form{grid-template-columns:repeat(2,1fr)}.inv-stats{grid-template-columns:1fr}}@media(max-width:560px){.inv-form,.supplier-form,.purchase-form{grid-template-columns:1fr}.inv-cards article{grid-template-columns:30px 1fr}.inv-cards article>button{grid-column:1/-1}.inv-tabs{overflow:auto}}
        `}</style>
    </ModuleShell>;
};
