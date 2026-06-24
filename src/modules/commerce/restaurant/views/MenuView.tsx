import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Image as ImageIcon, Search, Settings, GripVertical } from 'lucide-react';
import {
    restaurantApi,
    type RestaurantMenuCategory,
} from '@/api/restaurant.api';

export const MenuView = () => {
    const [categories, setCategories] = useState<RestaurantMenuCategory[]>([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const loadMenu = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await restaurantApi.getMenu();
            setCategories(response.categories);
            setError('');
        } catch {
            setError('Unable to load the menu.');
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

    const handleQuickAdd = async () => {
        if (!categories.length) {
            setError('Create or seed a category before adding an item.');
            return;
        }
        const name = window.prompt('Item name:')?.trim();
        if (!name) return;
        const priceText = window.prompt('Price in dollars:', '10.00');
        if (priceText === null) return;
        const price = Number(priceText);
        if (!Number.isFinite(price) || price <= 0) {
            setError('Price must be greater than zero.');
            return;
        }
        const category = selectedCategory === 'All'
            ? categories[0]
            : categories.find((entry) => entry.name === selectedCategory) || categories[0];

        try {
            await restaurantApi.createMenuItem({
                name,
                category_id: category.id,
                price,
            });
            await loadMenu();
        } catch {
            setError('Unable to add the menu item.');
        }
    };

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', gap: '24px' }}>
            <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Categories</h2>
                    <p style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>Drag to reorder</p>
                </div>

                {['All', ...categories.map((category) => category.name)].map((category) => (
                    <div
                        key={category}
                        onClick={() => setSelectedCategory(category)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            background: selectedCategory === category ? 'white' : 'transparent',
                            fontWeight: selectedCategory === category ? 600 : 500,
                            border: selectedCategory === category ? '1px solid var(--border-subtle)' : 'none',
                            color: selectedCategory === category ? 'var(--accent-primary)' : 'var(--fg-secondary)',
                        }}
                    >
                        {category !== 'All' && <GripVertical size={14} color="var(--fg-muted)" />}
                        {category === 'All' ? 'All Items' : category}
                    </div>
                ))}

                <button style={{ marginTop: 'auto', padding: '12px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--fg-secondary)', background: 'transparent', cursor: 'pointer' }}>
                    + New Category
                </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search menu items..."
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="input-base"
                            style={{ width: '100%', paddingLeft: '40px', background: 'white' }}
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button style={{ padding: '0 16px', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', fontWeight: 600 }}>
                            <Settings size={18} color="var(--fg-muted)" />
                        </button>
                        <button onClick={handleQuickAdd} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} /> New Product
                        </button>
                    </div>
                </div>

                {error && <div style={{ marginBottom: 16, color: '#b91c1c' }}>{error}</div>}
                {isLoading ? (
                    <div style={{ padding: 40, color: 'var(--fg-secondary)' }}>Loading menu...</div>
                ) : menu.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-secondary)' }}>
                        No menu items yet. Add your first product.
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px', overflowY: 'auto', paddingBottom: '40px' }}>
                        <div
                            onClick={handleQuickAdd}
                            style={{
                                border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', background: '#f8fafc', minHeight: '300px', color: 'var(--fg-secondary)',
                            }}
                        >
                            <Plus size={48} color="var(--fg-muted)" style={{ marginBottom: '16px' }} />
                            <span style={{ fontWeight: 600 }}>Add Product</span>
                        </div>

                        {filteredMenu.map((item) => (
                            <div key={item.id} style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ height: '180px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                    <ImageIcon size={48} color="#cbd5e1" />
                                    <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'white', borderRadius: '20px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, color: item.isAvailable ? '#166534' : '#991b1b' }}>
                                        {item.isAvailable ? 'IN STOCK' : 'SOLD OUT'}
                                    </div>
                                </div>
                                <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 700 }}>{item.name}</div>
                                    <div style={{ fontSize: '11px', width: 'fit-content', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: 'var(--fg-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {item.categoryName}
                                    </div>
                                    <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f1f5f9', fontWeight: 700, fontSize: '18px', color: 'var(--accent-primary)' }}>
                                        ${(item.price / 100).toFixed(2)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
