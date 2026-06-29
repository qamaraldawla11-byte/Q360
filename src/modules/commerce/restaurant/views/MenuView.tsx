import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { Image as ImageIcon, Loader2, Plus, Search } from 'lucide-react';
import {
    restaurantApi,
    type RestaurantMenuCategory,
} from '@/api/restaurant.api';

type Notice = { kind: 'success' | 'error'; text: string } | null;

const surface: CSSProperties = {
    background: '#ffffff',
    color: '#0f172a',
    border: '1px solid #d8dee8',
    borderRadius: 'var(--radius-md)',
};

const fieldStyle: CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 'var(--radius-sm)',
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#0f172a',
    font: 'inherit',
};

export const MenuView = () => {
    const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryName, setCategoryName] = useState('');
    const [itemName, setItemName] = useState('');
    const [itemPrice, setItemPrice] = useState('');
    const [itemCategoryId, setItemCategoryId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isCreatingCategory, setIsCreatingCategory] = useState(false);
    const [isCreatingItem, setIsCreatingItem] = useState(false);
    const [notice, setNotice] = useState<Notice>(null);

    const loadMenu = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await restaurantApi.getMenu();
            setCategories(response.categories);
            setItemCategoryId((current) => current || response.categories[0]?.id || '');
            setNotice(null);
        } catch {
            setNotice({ kind: 'error', text: 'Unable to load the menu.' });
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadMenu();
    }, [loadMenu]);

    const menu = useMemo(() => categories.flatMap((category) =>
        category.items.map((item) => ({ ...item, categoryName: category.name })),
    ), [categories]);

    const filteredMenu = menu.filter((item) => {
        const matchesCategory = selectedCategory === 'All' || item.categoryName === selectedCategory;
        return matchesCategory && item.name.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const createCategory = async (event: FormEvent) => {
        event.preventDefault();
        const name = categoryName.trim();
        if (!name || isCreatingCategory) return;
        setIsCreatingCategory(true);
        try {
            const category = await restaurantApi.createMenuCategory({ name });
            setCategoryName('');
            setSelectedCategory(category.name);
            setItemCategoryId(category.id);
            await loadMenu();
            setNotice({ kind: 'success', text: `Category "${category.name}" created.` });
        } catch {
            setNotice({ kind: 'error', text: 'Unable to create that category.' });
        } finally {
            setIsCreatingCategory(false);
        }
    };

    const createItem = async (event: FormEvent) => {
        event.preventDefault();
        const name = itemName.trim();
        const price = Number(itemPrice);
        if (!name || !Number.isFinite(price) || price <= 0 || !itemCategoryId || isCreatingItem) {
            setNotice({ kind: 'error', text: 'Add an item name, category, and price greater than 0.' });
            return;
        }
        setIsCreatingItem(true);
        try {
            await restaurantApi.createMenuItem({
                name,
                category_id: itemCategoryId,
                price,
            });
            setItemName('');
            setItemPrice('');
            await loadMenu();
            setNotice({ kind: 'success', text: `Menu item "${name}" created.` });
        } catch {
            setNotice({ kind: 'error', text: 'Unable to create that menu item.' });
        } finally {
            setIsCreatingItem(false);
        }
    };

    return (
        <div style={{ minHeight: 'calc(100vh - 100px)', display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 24, padding: 24 }}>
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Categories</h2>
                    <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: '4px 0 0' }}>Create setup groups for POS items.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {['All', ...categories.map((category) => category.name)].map((category) => (
                        <button
                            key={category}
                            type="button"
                            onClick={() => setSelectedCategory(category)}
                            style={{
                                ...surface,
                                padding: '12px 14px',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontWeight: selectedCategory === category ? 700 : 500,
                                borderColor: selectedCategory === category ? 'var(--accent-primary)' : '#d8dee8',
                            }}
                        >
                            {category === 'All' ? 'All Items' : category}
                        </button>
                    ))}
                    {!categories.length && !isLoading && (
                        <div style={{ ...surface, padding: 14, fontSize: 13, color: '#475569' }}>
                            No categories yet.
                        </div>
                    )}
                </div>

                <form onSubmit={createCategory} style={{ ...surface, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <label htmlFor="restaurant-category-name" style={{ fontSize: 13, fontWeight: 700 }}>New category</label>
                    <input
                        id="restaurant-category-name"
                        value={categoryName}
                        onChange={(event) => setCategoryName(event.target.value)}
                        placeholder="Mains"
                        style={fieldStyle}
                    />
                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={!categoryName.trim() || isCreatingCategory}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !categoryName.trim() || isCreatingCategory ? 0.65 : 1 }}
                    >
                        {isCreatingCategory ? <Loader2 size={16} /> : <Plus size={16} />} Create Category
                    </button>
                </form>
            </aside>

            <main style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(300px, 420px)', gap: 16, alignItems: 'start' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Search menu items..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            style={{ ...fieldStyle, paddingLeft: 40 }}
                        />
                    </div>

                    <form onSubmit={createItem} style={{ ...surface, padding: 16, display: 'grid', gap: 10 }}>
                        <strong style={{ fontSize: 14 }}>New menu item</strong>
                        <input
                            value={itemName}
                            onChange={(event) => setItemName(event.target.value)}
                            placeholder="Item name"
                            style={fieldStyle}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10 }}>
                            <select
                                value={itemCategoryId}
                                onChange={(event) => setItemCategoryId(event.target.value)}
                                style={fieldStyle}
                            >
                                <option value="">Choose category</option>
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>{category.name}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={itemPrice}
                                onChange={(event) => setItemPrice(event.target.value)}
                                placeholder="Price"
                                style={fieldStyle}
                            />
                        </div>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={!categories.length || isCreatingItem}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !categories.length || isCreatingItem ? 0.65 : 1 }}
                        >
                            {isCreatingItem ? <Loader2 size={16} /> : <Plus size={16} />} Create Menu Item
                        </button>
                    </form>
                </div>

                {notice && (
                    <div
                        role="status"
                        style={{ color: notice.kind === 'success' ? '#bbf7d0' : '#fecaca', fontWeight: 600 }}
                    >
                        {notice.text}
                    </div>
                )}

                {isLoading ? (
                    <div style={{ padding: 40, color: 'var(--fg-secondary)' }}>Loading menu...</div>
                ) : menu.length === 0 ? (
                    <div style={{ ...surface, padding: 40, textAlign: 'center', color: '#475569' }}>
                        Create a category, then add the first menu item for POS.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
                        {filteredMenu.map((item) => (
                            <div key={item.id} style={{ ...surface, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ height: 150, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    <ImageIcon size={42} color="#94a3b8" />
                                    <div style={{ position: 'absolute', top: 12, right: 12, background: '#ffffff', border: '1px solid #d8dee8', borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 800, color: item.isAvailable ? '#166534' : '#991b1b' }}>
                                        {item.isAvailable ? 'AVAILABLE' : 'SOLD OUT'}
                                    </div>
                                </div>
                                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                                    <div style={{ fontSize: 16, fontWeight: 800 }}>{item.name}</div>
                                    <div style={{ fontSize: 11, width: 'fit-content', padding: '2px 8px', borderRadius: 4, background: '#f1f5f9', color: '#475569', textTransform: 'uppercase', fontWeight: 700 }}>
                                        {item.categoryName}
                                    </div>
                                    <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid #e2e8f0', fontWeight: 800, fontSize: 18, color: '#1d4ed8' }}>
                                        ${(item.price / 100).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};
