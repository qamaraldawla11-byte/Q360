import { useState } from 'react';
import { useRestaurantStore } from '../store/restaurant.store';
import {
    Plus, Image as ImageIcon, Search, Settings,
    GripVertical
} from 'lucide-react';

export const MenuView = () => {
    const { menu, categories, addMenuItem, updateMenuItem } = useRestaurantStore();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredMenu = menu.filter(item => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    const handleQuickAdd = () => {
        const name = prompt('Quick Add Name:');
        if (!name) return;
        addMenuItem({
            id: `m-${Date.now()}`,
            name,
            price: 0,
            category: selectedCategory === 'All' ? categories[0] : selectedCategory,
            available: true,
            station: 'kitchen'
        });
    };

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', gap: '24px' }}>

            {/* Sidebar: Categories */}
            <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Categories</h2>
                    <p style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>Drag to reorder</p>
                </div>

                <div
                    onClick={() => setSelectedCategory('All')}
                    style={{
                        padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                        background: selectedCategory === 'All' ? 'white' : 'transparent',
                        fontWeight: selectedCategory === 'All' ? 600 : 500,
                        border: selectedCategory === 'All' ? '1px solid var(--border-subtle)' : 'none',
                        color: selectedCategory === 'All' ? 'var(--accent-primary)' : 'var(--fg-secondary)'
                    }}
                >
                    All Items
                </div>

                {categories.map(cat => (
                    <div
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '12px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                            background: selectedCategory === cat ? 'white' : 'transparent',
                            fontWeight: selectedCategory === cat ? 600 : 500,
                            border: selectedCategory === cat ? '1px solid var(--border-subtle)' : 'none',
                            color: selectedCategory === cat ? 'var(--accent-primary)' : 'var(--fg-secondary)'
                        }}
                    >
                        <GripVertical size={14} color="var(--fg-muted)" style={{ cursor: 'grab' }} />
                        {cat}
                    </div>
                ))}

                <button style={{ marginTop: 'auto', padding: '12px', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-md)', color: 'var(--fg-secondary)', background: 'transparent', cursor: 'pointer' }}>
                    + New Category
                </button>
            </div>

            {/* Main Content: Grid */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                {/* Header Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search menu items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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

                {/* Grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                    gap: '20px',
                    overflowY: 'auto',
                    paddingBottom: '40px'
                }}>

                    {/* Quick Add Card */}
                    <div
                        onClick={handleQuickAdd}
                        style={{
                            border: '2px dashed var(--border-subtle)', borderRadius: 'var(--radius-lg)',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', background: '#f8fafc', minHeight: '300px', color: 'var(--fg-secondary)'
                        }}
                    >
                        <Plus size={48} color="var(--fg-muted)" style={{ marginBottom: '16px' }} />
                        <span style={{ fontWeight: 600 }}>Add Product</span>
                    </div>

                    {filteredMenu.map(item => (
                        <div key={item.id} style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {/* Image / Preview */}
                            <div style={{ height: '180px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                                {item.image ? (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e2e8f0' }}>
                                        {/* Mock Image Placeholder */}
                                        <ImageIcon size={48} color="#94a3b8" />
                                    </div>
                                ) : (
                                    <ImageIcon size={48} color="#cbd5e1" />
                                )}

                                {/* Stock Toggle Badge */}
                                <button
                                    onClick={() => updateMenuItem(item.id, { available: !item.available })}
                                    style={{
                                        position: 'absolute', top: '12px', right: '12px',
                                        background: 'white', border: 'none', borderRadius: '20px',
                                        padding: '4px 10px', fontSize: '11px', fontWeight: 700,
                                        display: 'flex', alignItems: 'center', gap: '4px',
                                        color: item.available ? '#166534' : '#991b1b',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)', cursor: 'pointer'
                                    }}
                                >
                                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: item.available ? '#22c55e' : '#ef4444' }} />
                                    {item.available ? 'IN STOCK' : 'SOLD OUT'}
                                </button>
                            </div>

                            {/* Content & Inline Edit */}
                            <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>

                                {/* Name Input */}
                                <input
                                    className="input-ghost"
                                    value={item.name}
                                    onChange={(e) => updateMenuItem(item.id, { name: e.target.value })}
                                    style={{ fontSize: '16px', fontWeight: 700, width: '100%', padding: '4px 0' }}
                                />

                                {/* Meta */}
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f1f5f9', color: 'var(--fg-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {item.category}
                                    </span>
                                    {item.station && (
                                        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#f0fdf4', color: '#166534', textTransform: 'uppercase', fontWeight: 600 }}>
                                            {item.station}
                                        </span>
                                    )}
                                </div>

                                {/* Footer: Price & Actions */}
                                <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>

                                    <div style={{ position: 'relative', width: '80px' }}>
                                        <span style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', fontWeight: 600, color: 'var(--accent-primary)' }}>$</span>
                                        <input
                                            type="number"
                                            value={item.price}
                                            onChange={(e) => updateMenuItem(item.id, { price: parseFloat(e.target.value) })}
                                            style={{
                                                width: '100%', border: 'none', background: 'transparent',
                                                fontWeight: 700, fontSize: '18px', color: 'var(--accent-primary)',
                                                paddingLeft: '14px', outline: 'none'
                                            }}
                                        />
                                    </div>

                                    <button style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', padding: '4px' }}>
                                        <Settings size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
