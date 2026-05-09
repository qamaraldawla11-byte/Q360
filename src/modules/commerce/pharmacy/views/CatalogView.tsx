import { useState } from 'react';
import { usePharmacyStore } from '../store/pharmacy.store';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Plus, Search, Pill, GripVertical } from 'lucide-react';

export const CatalogView = () => {
    const { inventory, categories } = usePharmacyStore();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchQuery, setSearchQuery] = useState('');

    const filteredInventory = inventory.filter(item => {
        const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.genericName?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <ModuleShell fullHeight padding="20px 32px">
            <PageHeader
                title="Medicine Catalog"
                subtitle="Manage formulary and inventory details."
                actions={
                    <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Plus size={18} /> Add Medicine
                    </button>
                }
            />

            <div style={{ display: 'flex', gap: '24px', height: 'calc(100% - 140px)' }}>

                {/* Categories Sidebar */}
                <div style={{ width: '260px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
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
                        All Medicines
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
                            <GripVertical size={14} color="var(--fg-muted)" />
                            {cat}
                        </div>
                    ))}
                </div>

                {/* Main Grid */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                    {/* Search Actions */}
                    <div style={{ marginBottom: '24px', position: 'relative', maxWidth: '400px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-muted)' }} />
                        <input
                            type="text"
                            placeholder="Search by brand or generic name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="input-base"
                            style={{ width: '100%', paddingLeft: '40px', background: 'white' }}
                        />
                    </div>

                    {/* Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '20px',
                        overflowY: 'auto',
                        paddingBottom: '20px'
                    }}>
                        {filteredInventory.map(item => (
                            <div key={item.id} style={{
                                background: 'white', borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border-subtle)', padding: '20px',
                                display: 'flex', flexDirection: 'column', gap: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div style={{ width: '40px', height: '40px', background: '#f0f9ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                                        <Pill size={20} />
                                    </div>
                                    {item.requiresRx && (
                                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#be123c', background: '#ffe4e6', padding: '2px 8px', borderRadius: '4px' }}>
                                            RX ONLY
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600 }}>{item.name}</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--fg-secondary)' }}>{item.genericName}</p>
                                </div>

                                <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--fg-secondary)', marginTop: 'auto' }}>
                                    <span style={{ fontWeight: 600, color: item.stock <= item.minStock ? '#ef4444' : 'var(--fg-primary)' }}>
                                        {item.stock} {item.dosage || 'units'}
                                    </span>
                                    <span>•</span>
                                    <span>${item.price.toFixed(2)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </ModuleShell>
    );
};
