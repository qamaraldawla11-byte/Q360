import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Clock3, Eye, EyeOff, Image as ImageIcon, Loader2, Pencil, Plus, Search, Trash2, Upload, UtensilsCrossed, X } from 'lucide-react';
import { restaurantApi, type RestaurantMenuCategory, type RestaurantMenuItem } from '@/api/restaurant.api';

type Notice = { kind: 'success' | 'error'; text: string } | null;

export const MenuView = () => {
    const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [query, setQuery] = useState('');
    const [categoryName, setCategoryName] = useState('');
    const [notice, setNotice] = useState<Notice>(null);
    const [loading, setLoading] = useState(true);
    const [savingItem, setSavingItem] = useState(false);
    const [savingCategory, setSavingCategory] = useState(false);
    const [editing, setEditing] = useState<RestaurantMenuItem | null>(null);
    const [form, setForm] = useState({ name: '', description: '', categoryId: '', price: '', prepTimeMinutes: '0', isAvailable: true });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const editorRef = useRef<HTMLFormElement>(null);
    const itemNameRef = useRef<HTMLInputElement>(null);
    const categoryNameRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await restaurantApi.getMenu();
            setCategories(response.categories);
            setForm(current => ({ ...current, categoryId: current.categoryId || response.categories[0]?.id || '' }));
            setNotice(null);
        } catch (error) {
            setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'The menu could not be loaded. Refresh and try again.' });
        } finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const items = useMemo(() => categories.flatMap(category => category.items.map(item => ({ ...item, categoryName: category.name }))), [categories]);
    const visibleItems = useMemo(() => items.filter(item => {
        const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
        return matchesCategory && `${item.name} ${item.description || ''}`.toLowerCase().includes(query.trim().toLowerCase());
    }), [items, query, selectedCategory]);

    const resetForm = () => {
        setEditing(null);
        setForm({ name: '', description: '', categoryId: categories[0]?.id || '', price: '', prepTimeMinutes: '0', isAvailable: true });
        setImageFile(null);
    };
    const focusEditor = () => window.requestAnimationFrame(() => {
        editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        itemNameRef.current?.focus({ preventScroll: true });
    });
    const openNewItem = () => {
        resetForm();
        setQuery('');
        focusEditor();
    };
    const beginEdit = (item: RestaurantMenuItem) => {
        setEditing(item);
        setForm({ name: item.name, description: item.description || '', categoryId: item.categoryId, price: (item.price / 100).toFixed(2), prepTimeMinutes: String(item.prepTimeMinutes), isAvailable: item.isAvailable });
        setImageFile(null);
        focusEditor();
    };

    const createCategory = async (event: FormEvent) => {
        event.preventDefault(); const name = categoryName.trim(); if (!name || savingCategory) return; setSavingCategory(true);
        try { const category = await restaurantApi.createMenuCategory({ name }); setCategoryName(''); setSelectedCategory(category.id); await load(); setForm(current => ({ ...current, categoryId: category.id })); setNotice({ kind: 'success', text: `${category.name} category created and selected.` }); categoryNameRef.current?.focus(); }
        catch { setNotice({ kind: 'error', text: 'That category could not be created. It may already exist.' }); }
        finally { setSavingCategory(false); }
    };
    const renameCategory = async (category: RestaurantMenuCategory) => {
        const name = window.prompt('Category name', category.name)?.trim(); if (!name || name === category.name) return;
        try { await restaurantApi.updateMenuCategory(category.id, { name }); await load(); setNotice({ kind: 'success', text: `Category renamed to ${name}.` }); }
        catch { setNotice({ kind: 'error', text: 'Unable to rename this category.' }); }
    };
    const deleteCategory = async (category: RestaurantMenuCategory) => {
        if (!window.confirm(`Remove the empty “${category.name}” category?`)) return;
        try { await restaurantApi.deleteMenuCategory(category.id); if (selectedCategory === category.id) setSelectedCategory('all'); await load(); setNotice({ kind: 'success', text: `${category.name} category removed.` }); }
        catch (error) { setNotice({ kind: 'error', text: error instanceof Error ? error.message : 'Move or remove this category’s items first.' }); }
    };
    const selectImage = (file?: File) => {
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
            setNotice({ kind: 'error', text: 'Choose a PNG, JPEG, or WebP image no larger than 2 MB.' }); return;
        }
        setImageFile(file);
    };
    const saveItem = async (event: FormEvent) => {
        event.preventDefault(); const price = Number(form.price); const prepTimeMinutes = Number(form.prepTimeMinutes);
        if (!form.name.trim() || !form.categoryId || !Number.isFinite(price) || price <= 0 || !Number.isSafeInteger(prepTimeMinutes) || prepTimeMinutes < 0) { setNotice({ kind: 'error', text: 'Add a name, category, valid price and preparation time.' }); return; }
        setSavingItem(true);
        try {
            let itemId: string;
            if (editing) { const updated = await restaurantApi.updateMenuItem(editing.id, { name: form.name.trim(), description: form.description, categoryId: form.categoryId, price, prepTimeMinutes, isAvailable: form.isAvailable }); itemId = updated.id; }
            else { const created = await restaurantApi.createMenuItem({ name: form.name.trim(), category_id: form.categoryId, price, description: form.description, prep_time_minutes: prepTimeMinutes }); itemId = created.id; if (!form.isAvailable) await restaurantApi.updateMenuItem(created.id, { isAvailable: false }); }
            if (imageFile) await restaurantApi.uploadMenuItemImage(itemId, imageFile);
            setNotice({ kind: 'success', text: `${form.name.trim()} ${editing ? 'updated' : 'added to the menu'}.` }); resetForm(); await load();
        } catch { setNotice({ kind: 'error', text: 'Unable to save this menu item.' }); } finally { setSavingItem(false); }
    };
    const toggleAvailability = async (item: RestaurantMenuItem) => {
        try { await restaurantApi.updateMenuItem(item.id, { isAvailable: !item.isAvailable }); await load(); setNotice({ kind: 'success', text: `${item.name} is now ${item.isAvailable ? 'sold out' : 'available'}.` }); }
        catch { setNotice({ kind: 'error', text: 'Unable to update availability.' }); }
    };

    return <div className="menu-manager">
        <header className="menu-hero"><div><span className="menu-eyebrow"><UtensilsCrossed size={14} /> Restaurant menu</span><h1>Build a menu customers can understand.</h1><p>Manage categories, descriptions, pricing, preparation time and availability. Available items also appear on your public QR menu.</p></div><div className="menu-count"><strong>{items.length}</strong><span>menu items</span></div></header>
        {notice && <div className={`menu-notice menu-notice--${notice.kind}`}>{notice.text}<button type="button" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}
        <div className="menu-workspace">
            <aside className="menu-sidebar"><div className="menu-panel-title"><div><strong>Categories</strong><small>Organize the customer menu</small></div></div>
                <button type="button" className={selectedCategory === 'all' ? 'category-all active' : 'category-all'} onClick={() => setSelectedCategory('all')}><span>All items</span><b>{items.length}</b></button>
                {categories.map(category => <div className={selectedCategory === category.id ? 'category-row active' : 'category-row'} key={category.id}><button type="button" onClick={() => setSelectedCategory(category.id)}><span>{category.name}</span><b>{category.items.length}</b></button><button type="button" className="category-edit" onClick={() => void renameCategory(category)} aria-label={`Rename ${category.name}`}><Pencil size={13} /></button><button type="button" className="category-delete" onClick={() => void deleteCategory(category)} aria-label={`Remove ${category.name}`} title="Remove empty category"><Trash2 size={13} /></button></div>)}
                <form className="category-form" onSubmit={createCategory}><input ref={categoryNameRef} value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="New category" maxLength={80} aria-label="New category name" /><button type="submit" disabled={!categoryName.trim() || savingCategory} aria-label="Add category" title="Add category">{savingCategory ? <Loader2 size={16} /> : <Plus size={16} />}</button></form>
            </aside>
            <main className="menu-main"><div className="menu-toolbar"><label><Search size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search items or descriptions" /></label><button type="button" onClick={openNewItem}><Plus size={17} /> New item</button></div>
                {loading ? <div className="menu-state"><Loader2 size={22} /> Loading menu…</div> : !visibleItems.length ? <div className="menu-state"><UtensilsCrossed size={32} /><strong>No items in this view</strong><span>Create an item or choose another category.</span></div> : <div className="menu-grid">{visibleItems.map(item => <article className={!item.isAvailable ? 'menu-card unavailable' : 'menu-card'} key={item.id}><div className="menu-card-image">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <ImageIcon size={34} />}<span>{item.isAvailable ? 'Available' : 'Sold out'}</span></div><div className="menu-card-body"><div className="menu-card-heading"><div><small>{categories.find(category => category.id === item.categoryId)?.name}</small><h3>{item.name}</h3></div><strong>${(item.price / 100).toFixed(2)}</strong></div><p>{item.description || 'No description yet.'}</p><div className="menu-card-meta"><span><Clock3 size={14} /> {item.prepTimeMinutes || 0} min</span></div><div className="menu-card-actions"><button type="button" onClick={() => beginEdit(item)}><Pencil size={15} /> Edit</button><button type="button" onClick={() => void toggleAvailability(item)}>{item.isAvailable ? <EyeOff size={15} /> : <Eye size={15} />}{item.isAvailable ? 'Mark sold out' : 'Make available'}</button></div></div></article>)}</div>}
            </main>
            <form ref={editorRef} className="item-editor" onSubmit={saveItem}><div className="menu-panel-title"><div><strong>{editing ? 'Edit menu item' : 'New menu item'}</strong><small>{editing ? 'Changes update POS and public menu' : 'Add an item used by POS'}</small></div>{editing && <button type="button" onClick={resetForm}><X size={17} /></button>}</div>
                <label>Item name<input ref={itemNameRef} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} maxLength={120} placeholder="Chicken sandwich" /></label><label>Description<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} rows={3} placeholder="Short customer-friendly description" /></label><label>Category<select value={form.categoryId} onChange={event => setForm({ ...form, categoryId: event.target.value })}><option value="">Choose category</option>{categories.map(category => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
                <div className="editor-split"><label>Price<input type="number" min="0.01" step="0.01" value={form.price} onChange={event => setForm({ ...form, price: event.target.value })} placeholder="0.00" /></label><label>Prep minutes<input type="number" min="0" max="480" step="1" value={form.prepTimeMinutes} onChange={event => setForm({ ...form, prepTimeMinutes: event.target.value })} /></label></div><div className="item-image-upload">{(imageFile || editing?.imageUrl) && <img src={imageFile ? URL.createObjectURL(imageFile) : editing?.imageUrl || ''} alt="Menu item preview" />}<input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={event => selectImage(event.target.files?.[0])}/><button type="button" onClick={() => imageInputRef.current?.click()}><Upload size={15}/> {imageFile || editing?.imageUrl ? 'Replace image' : 'Upload image'}</button><small>PNG, JPEG, or WebP · maximum 2 MB</small></div><label className="availability-toggle"><input type="checkbox" checked={form.isAvailable} onChange={event => setForm({ ...form, isAvailable: event.target.checked })} /><span><strong>Available for sale</strong><small>Visible on Sales and customer QR menu</small></span></label><button className="save-item" type="submit" disabled={savingItem || !categories.length}>{savingItem ? <Loader2 size={17} /> : <Plus size={17} />}{savingItem ? 'Saving…' : editing ? 'Save changes' : 'Add menu item'}</button>{!categories.length && <small className="editor-help">Create a category before adding an item.</small>}
            </form>
        </div>
        <style>{`
        .menu-manager{padding:clamp(18px,3vw,34px);color:#e5e7eb;max-width:1500px;margin:auto}.menu-hero{display:flex;justify-content:space-between;gap:24px;margin-bottom:24px;padding:26px;border:1px solid #293241;border-radius:20px;background:linear-gradient(135deg,#111827,#172033)}.menu-eyebrow{display:flex;align-items:center;gap:7px;color:#fb923c;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.menu-hero h1{margin:9px 0 8px;color:#fff;font-size:clamp(26px,4vw,40px);letter-spacing:-.035em}.menu-hero p{max-width:700px;margin:0;color:#aab3c2;line-height:1.55}.menu-count{min-width:120px;display:grid;place-content:center;text-align:center;border-left:1px solid #344053}.menu-count strong{font-size:32px;color:#fff}.menu-count span{color:#94a3b8;font-size:12px}.menu-notice{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding:12px 14px;border-radius:11px;font-size:13px}.menu-notice--success{background:#ecfdf5;color:#047857}.menu-notice--error{background:#fef2f2;color:#b91c1c}.menu-notice button{border:0;background:transparent;color:inherit}.menu-workspace{display:grid;grid-template-columns:210px minmax(0,1fr) 310px;gap:18px;align-items:start}.menu-sidebar,.item-editor{position:sticky;top:76px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:16px;padding:16px}.menu-panel-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:15px}.menu-panel-title strong{display:block}.menu-panel-title small{display:block;margin-top:3px;color:#64748b;font-size:11px}.menu-panel-title>button{border:0;background:transparent}.category-all,.category-row{width:100%;min-height:40px;display:flex;align-items:center;border:0;border-radius:9px;background:transparent;color:#475569}.category-all{justify-content:space-between;padding:9px 10px;text-align:left}.category-row>button:first-child{flex:1;display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border:0;background:transparent;color:inherit;text-align:left}.category-all.active,.category-row.active{background:#fff7ed;color:#c2410c;font-weight:800}.category-all b,.category-row b{font-size:10px}.category-edit{width:30px;border:0;background:transparent;color:inherit}.category-form{display:grid;grid-template-columns:1fr 36px;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0}.category-form input,.item-editor input,.item-editor select,.item-editor textarea{width:100%;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a;font:inherit}.category-form input{min-width:0;padding:8px}.category-form button{display:grid;place-items:center;border:0;border-radius:9px;background:#f97316;color:#fff}.menu-main{min-width:0}.menu-toolbar{display:flex;justify-content:space-between;gap:10px;margin-bottom:16px}.menu-toolbar label{flex:1;display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid #344053;border-radius:11px;background:#111827;color:#94a3b8}.menu-toolbar input{width:100%;height:43px;border:0;outline:0;background:transparent;color:#fff;font:inherit}.menu-toolbar>button{display:flex;align-items:center;gap:7px;padding:0 15px;border:0;border-radius:11px;background:#f97316;color:#fff;font-weight:800}.menu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:15px}.menu-card{overflow:hidden;border:1px solid #d8dee8;border-radius:16px;background:#fff;color:#0f172a}.menu-card.unavailable{opacity:.72}.menu-card-image{height:138px;position:relative;display:grid;place-items:center;overflow:hidden;background:#e9eef5;color:#94a3b8}.menu-card-image img{width:100%;height:100%;object-fit:cover}.menu-card-image span{position:absolute;top:10px;right:10px;padding:4px 8px;border-radius:999px;background:#fff;color:#166534;font-size:10px;font-weight:900}.unavailable .menu-card-image span{color:#991b1b}.menu-card-body{padding:15px}.menu-card-heading{display:flex;justify-content:space-between;gap:10px}.menu-card-heading small{color:#f97316;font-weight:800;text-transform:uppercase}.menu-card-heading h3{margin:4px 0 0;font-size:17px}.menu-card-heading>strong{color:#0f172a;font-size:17px}.menu-card-body>p{min-height:38px;margin:10px 0;color:#64748b;font-size:12px;line-height:1.5}.menu-card-meta{display:flex;color:#64748b;font-size:11px}.menu-card-meta span,.menu-card-actions button{display:flex;align-items:center;gap:5px}.menu-card-actions{display:flex;gap:7px;margin-top:13px;padding-top:12px;border-top:1px solid #e2e8f0}.menu-card-actions button{flex:1;justify-content:center;min-height:34px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#475569;font-size:11px;font-weight:800}.menu-state{min-height:320px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed #475569;border-radius:16px;color:#94a3b8}.item-editor{display:flex;flex-direction:column;gap:12px}.item-editor label{display:flex;flex-direction:column;gap:6px;color:#334155;font-size:11px;font-weight:800}.item-editor label>small{font-weight:500}.item-editor input,.item-editor select,.item-editor textarea{padding:10px 11px;font-size:13px}.editor-split{display:grid;grid-template-columns:1fr 1fr;gap:9px}.availability-toggle{flex-direction:row!important;align-items:center;padding:11px;border:1px solid #e2e8f0;border-radius:10px}.availability-toggle input{width:16px!important}.availability-toggle span small{display:block;margin-top:2px;color:#64748b;font-weight:500}.save-item{min-height:42px;display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:10px;background:#f97316;color:#fff;font-weight:800}.save-item:disabled{opacity:.55}.editor-help{text-align:center;color:#b45309}@media(max-width:1180px){.menu-workspace{grid-template-columns:190px minmax(0,1fr)}.item-editor{position:static;grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.item-editor .menu-panel-title,.item-editor .availability-toggle,.item-editor .save-item,.item-editor .editor-help{grid-column:1/-1}}@media(max-width:760px){.menu-hero{padding:20px}.menu-count{display:none}.menu-workspace{grid-template-columns:1fr}.menu-sidebar,.item-editor{position:static}.item-editor{display:flex}.menu-toolbar{flex-direction:column}.menu-toolbar label{flex:auto}.menu-toolbar>button{min-height:42px;justify-content:center}}
        .category-form{grid-template-columns:1fr 40px}.category-form button{min-height:40px}.category-form button:disabled{opacity:.5}.menu-grid{grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}.menu-card{border-radius:14px}.menu-card-image{height:82px}.menu-card-image span{top:8px;right:8px;padding:4px 7px;font-size:9px}.menu-card-body{padding:12px}.menu-card-heading{gap:8px}.menu-card-heading small{font-size:10px}.menu-card-heading h3,.menu-card-heading>strong{font-size:15px}.menu-card-body>p{min-height:32px;margin:7px 0;font-size:11px;line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.menu-card-meta{font-size:10px}.menu-card-actions{gap:6px;margin-top:9px;padding-top:9px}.menu-card-actions button{min-height:32px;font-size:10px;cursor:pointer}.menu-state{min-height:260px}.item-editor{scroll-margin-top:76px}@media(max-width:760px){.menu-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:470px){.menu-grid{grid-template-columns:1fr}}
        .category-delete{width:30px;border:0;background:transparent;color:#dc2626}.item-image-upload{display:flex;flex-direction:column;gap:7px}.item-image-upload img{width:100%;height:110px;object-fit:cover;border-radius:10px;border:1px solid #e2e8f0}.item-image-upload button{min-height:38px;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#334155;font-weight:800}.item-image-upload small{color:#64748b;text-align:center}
        `}</style>
    </div>;
};
