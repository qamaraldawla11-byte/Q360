import { useState, useEffect } from 'react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { Tag, Percent, Calendar, TrendingUp, Plus } from 'lucide-react';
import { promotionsService } from '@/core/services/promotions.service';
import type { Offer } from '@/core/mocks/offers.mock';

export const OffersView = () => {
    const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'expired'>('active');
    const [offers, setOffers] = useState<Offer[]>([]);

    useEffect(() => {
        promotionsService.getOffers().then(setOffers);
    }, []);

    const filteredOffers = offers.filter(offer => offer.status === activeTab);

    const getOfferBadgeColor = (status: string) => {
        switch (status) {
            case 'active': return { bg: '#dcfce7', color: '#166534' };
            case 'scheduled': return { bg: '#dbeafe', color: '#1e40af' };
            case 'expired': return { bg: '#f3f4f6', color: '#6b7280' };
            default: return { bg: '#f3f4f6', color: '#6b7280' };
        }
    };

    const getOfferTypeIcon = (type: string) => {
        switch (type) {
            case 'percentage': return <Percent size={20} />;
            case 'fixed': return <Tag size={20} />;
            case 'bogo': return <TrendingUp size={20} />;
            default: return <Tag size={20} />;
        }
    };

    const getOfferTypeLabel = (type: string, value: number) => {
        switch (type) {
            case 'percentage': return `${value}% OFF`;
            case 'fixed': return `$${value} OFF`;
            case 'bogo': return 'BUY 1 GET 1';
            default: return 'OFFER';
        }
    };

    return (
        <ModuleShell>
            <PageHeader
                title="Offers & Pricing"
                subtitle="Create and manage promotional campaigns"
            />

            {/* Stats Overview */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '32px' }}>
                {[
                    { label: 'Active Offers', value: offers.filter(o => o.status === 'active').length.toString(), color: '#10b981' },
                    { label: 'Scheduled', value: offers.filter(o => o.status === 'scheduled').length.toString(), color: '#3b82f6' },
                    { label: 'Revenue Impact', value: '$12,450', color: '#f59e0b' },
                    { label: 'Avg. Discount', value: '18%', color: '#8b5cf6' },
                ].map((stat, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '24px', borderRadius: '16px',
                        border: '1px solid var(--border-subtle)'
                    }}>
                        <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color, marginBottom: '8px' }}>
                            {stat.value}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--fg-secondary)' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ marginBottom: '24px', display: 'flex', gap: '8px', borderBottom: '2px solid var(--border-subtle)' }}>
                {(['active', 'scheduled', 'expired'] as const).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '12px 24px',
                            border: 'none',
                            background: 'transparent',
                            borderBottom: activeTab === tab ? '2px solid #10b981' : '2px solid transparent',
                            marginBottom: '-2px',
                            fontWeight: activeTab === tab ? 700 : 500,
                            color: activeTab === tab ? '#10b981' : 'var(--fg-secondary)',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            fontSize: '14px'
                        }}
                    >
                        {tab} ({offers.filter(o => o.status === tab).length})
                    </button>
                ))}
            </div>

            {/* Offers Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                {/* Create New Offer Card */}
                <div style={{
                    background: 'white',
                    borderRadius: '16px',
                    border: '2px dashed var(--border-subtle)',
                    padding: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minHeight: '250px'
                }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
                    onClick={() => alert('Create offer modal would open here')}
                >
                    <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: '#10b98115',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '16px'
                    }}>
                        <Plus size={28} color="#10b981" />
                    </div>
                    <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px' }}>Create New Offer</div>
                    <div style={{ fontSize: '13px', color: 'var(--fg-secondary)', textAlign: 'center' }}>
                        Launch promotional campaigns
                    </div>
                </div>

                {/* Offer Cards */}
                {filteredOffers.map((offer) => {
                    const badgeColor = getOfferBadgeColor(offer.status);
                    return (
                        <div key={offer.id} style={{
                            background: 'white',
                            borderRadius: '16px',
                            border: '1px solid var(--border-subtle)',
                            padding: '24px',
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div style={{
                                    width: '48px',
                                    height: '48px',
                                    borderRadius: '12px',
                                    background: '#10b98115',
                                    color: '#10b981',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    {getOfferTypeIcon(offer.type)}
                                </div>
                                <span style={{
                                    padding: '6px 12px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    background: badgeColor.bg,
                                    color: badgeColor.color,
                                    textTransform: 'uppercase'
                                }}>
                                    {offer.status}
                                </span>
                            </div>

                            <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '12px' }}>{offer.name}</h3>

                            <div style={{
                                padding: '12px 16px',
                                background: '#fef3c7',
                                borderRadius: '10px',
                                marginBottom: '16px',
                                fontSize: '16px',
                                fontWeight: 700,
                                color: '#92400e',
                                textAlign: 'center'
                            }}>
                                {getOfferTypeLabel(offer.type, offer.value)}
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--fg-secondary)', marginBottom: '8px' }}>
                                    APPLICABLE TO:
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {offer.products.map((product, i) => (
                                        <span key={i} style={{
                                            padding: '4px 10px',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            background: '#f8fafc',
                                            border: '1px solid var(--border-subtle)'
                                        }}>
                                            {product}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--fg-secondary)' }}>
                                <Calendar size={14} />
                                {offer.startDate} to {offer.endDate}
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button style={{
                                    flex: 1,
                                    padding: '10px',
                                    background: '#10b981',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}>
                                    Edit
                                </button>
                                <button style={{
                                    padding: '10px 16px',
                                    background: 'white',
                                    border: '1px solid var(--border-subtle)',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                    fontSize: '14px',
                                    cursor: 'pointer'
                                }}>
                                    Analytics
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </ModuleShell>
    );
};
