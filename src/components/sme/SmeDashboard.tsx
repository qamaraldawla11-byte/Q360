import {
    AlertTriangle,
    Boxes,
    Clock3,
    DollarSign,
    PackageCheck,
    ReceiptText,
    ShoppingBag,
    Sparkles,
    UsersRound,
    Utensils,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import type { UserSegment } from '@/types/user';

export interface SmeInsight {
    id: string;
    title: string;
    detail: string;
    time?: string;
}

export interface SmeActivity {
    id: string;
    label: string;
    detail?: string;
    time: string;
}

export interface SmeDashboardProps {
    revenueToday?: string;
    activeOrders?: number;
    averageResponseTime?: string;
    segmentMetric?: { label: string; value: string | number };
    insights?: SmeInsight[];
    activities?: SmeActivity[];
}

const SEGMENT_METRICS: Record<'restaurant' | 'pharmacy' | 'supermarket' | 'retail', { label: string; value: string; icon: typeof Utensils }> = {
    restaurant: { label: 'Tables occupied', value: '0 / 0', icon: Utensils },
    pharmacy: { label: 'Prescriptions queued', value: '0', icon: ReceiptText },
    supermarket: { label: 'Low stock items', value: '0', icon: Boxes },
    retail: { label: 'Items sold today', value: '0', icon: ShoppingBag },
};

function isSmeSegment(segment: UserSegment | null | undefined): segment is keyof typeof SEGMENT_METRICS {
    return Boolean(segment && segment in SEGMENT_METRICS);
}

function SegmentPanel({ segment }: { segment: keyof typeof SEGMENT_METRICS }) {
    if (segment === 'restaurant') {
        return (
            <Panel title="Floor map" subtitle="Live table availability">
                <div style={styles.floorGrid}>
                    {['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((table, index) => (
                        <div key={table} style={{ ...styles.table, opacity: index < 2 ? 1 : 0.55 }}>
                            <span>{table}</span>
                            <small>{index < 2 ? 'Occupied' : 'Available'}</small>
                        </div>
                    ))}
                </div>
            </Panel>
        );
    }

    const content = {
        supermarket: {
            title: 'Stock alerts',
            subtitle: 'Items that need attention',
            rows: ['No low-stock alerts', 'Inventory levels look healthy'],
        },
        pharmacy: {
            title: 'Dispensing queue',
            subtitle: 'Prescription workflow',
            rows: ['No prescriptions waiting', 'All safety checks are clear'],
        },
        retail: {
            title: 'Store performance',
            subtitle: 'Sales floor snapshot',
            rows: ['No stock exceptions', 'All registers are ready'],
        },
    }[segment];

    return (
        <Panel title={content.title} subtitle={content.subtitle}>
            <div style={styles.statusList}>
                {content.rows.map((row, index) => (
                    <div key={row} style={styles.statusRow}>
                        {index === 0 ? <PackageCheck size={17} /> : <AlertTriangle size={17} />}
                        <span>{row}</span>
                    </div>
                ))}
            </div>
        </Panel>
    );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <section style={styles.panel}>
            <div style={styles.panelHeader}>
                <div>
                    <h2 style={styles.panelTitle}>{title}</h2>
                    {subtitle && <p style={styles.panelSubtitle}>{subtitle}</p>}
                </div>
            </div>
            {children}
        </section>
    );
}

export const SmeDashboard = ({
    revenueToday = '$0.00',
    activeOrders = 0,
    averageResponseTime = '—',
    segmentMetric,
    insights = [],
    activities = [],
}: SmeDashboardProps) => {
    const user = useAuthStore(state => state.user);
    const segment = isSmeSegment(user?.segment) ? user.segment : 'retail';
    const defaultSegmentMetric = SEGMENT_METRICS[segment];
    const metrics = [
        { label: 'Revenue today', value: revenueToday, icon: DollarSign, color: '#34d399' },
        { label: 'Active orders', value: activeOrders, icon: ShoppingBag, color: '#60a5fa' },
        {
            label: segmentMetric?.label ?? defaultSegmentMetric.label,
            value: segmentMetric?.value ?? defaultSegmentMetric.value,
            icon: defaultSegmentMetric.icon,
            color: '#f59e0b',
        },
        { label: 'Avg response time', value: averageResponseTime, icon: Clock3, color: '#c084fc' },
    ];

    return (
        <div style={styles.dashboard}>
            <div style={styles.intro}>
                <div>
                    <p style={styles.eyebrow}>Operational overview</p>
                    <h1 style={styles.title}>Good to see you, {user?.name?.split(' ')[0] || 'there'}.</h1>
                </div>
                <span style={styles.liveBadge}><span style={styles.liveDot} /> Live</span>
            </div>

            <section style={styles.statsGrid} aria-label="Today's metrics">
                {metrics.map(metric => (
                    <article key={metric.label} style={styles.metricCard}>
                        <div style={{ ...styles.metricIcon, color: metric.color, background: `${metric.color}18` }}>
                            <metric.icon size={19} />
                        </div>
                        <span style={styles.metricLabel}>{metric.label}</span>
                        <strong style={styles.metricValue}>{metric.value}</strong>
                    </article>
                ))}
            </section>

            <Panel title="Business Pulse" subtitle="Latest insights from your agent">
                {insights.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}><Sparkles size={20} /></div>
                        <div>
                            <strong style={styles.emptyTitle}>Your agent is warming up</strong>
                            <p style={styles.emptyCopy}>Check back after your first day of operations.</p>
                        </div>
                    </div>
                ) : (
                    <div style={styles.insightList}>
                        {insights.slice(0, 3).map(insight => (
                            <article key={insight.id} style={styles.insight}>
                                <Sparkles size={16} style={{ color: '#fbbf24', flexShrink: 0 }} />
                                <div style={{ flex: 1 }}>
                                    <strong style={styles.insightTitle}>{insight.title}</strong>
                                    <p style={styles.insightDetail}>{insight.detail}</p>
                                </div>
                                {insight.time && <time style={styles.itemTime}>{insight.time}</time>}
                            </article>
                        ))}
                    </div>
                )}
            </Panel>

            <div style={styles.lowerGrid}>
                <SegmentPanel segment={segment} />
                <Panel title="Recent activity" subtitle="Updates across your workspace">
                    {activities.length === 0 ? (
                        <div style={styles.activityEmpty}>
                            <UsersRound size={20} />
                            <span>No recent activity yet.</span>
                        </div>
                    ) : (
                        <div style={styles.activityList}>
                            {activities.map(activity => (
                                <article key={activity.id} style={styles.activity}>
                                    <span style={styles.activityDot} />
                                    <div style={{ flex: 1 }}>
                                        <strong style={styles.activityLabel}>{activity.label}</strong>
                                        {activity.detail && <p style={styles.activityDetail}>{activity.detail}</p>}
                                    </div>
                                    <time style={styles.itemTime}>{activity.time}</time>
                                </article>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    );
};

const styles: Record<string, React.CSSProperties> = {
    dashboard: { maxWidth: 1440, margin: '0 auto', padding: '26px 28px 40px', color: 'var(--fg-primary)' },
    intro: { marginBottom: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20 },
    eyebrow: { margin: '0 0 5px', color: 'var(--fg-muted)', fontSize: 11, fontWeight: 750, letterSpacing: '.11em', textTransform: 'uppercase' },
    title: { margin: 0, fontSize: 24, lineHeight: 1.2, fontWeight: 720, letterSpacing: '-.025em' },
    liveBadge: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 10px', border: '1px solid var(--surface-400)', borderRadius: 999, color: 'var(--fg-secondary)', fontSize: 11 },
    liveDot: { width: 7, height: 7, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 0 4px rgba(52,211,153,.12)' },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 16 },
    metricCard: { minHeight: 132, padding: 17, display: 'grid', gridTemplateColumns: 'auto 1fr', gridTemplateRows: 'auto 1fr', columnGap: 11, border: '1px solid var(--surface-400)', borderRadius: 14, background: 'var(--surface-100)', boxShadow: 'var(--shadow-sm)' },
    metricIcon: { width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 9 },
    metricLabel: { alignSelf: 'center', color: 'var(--fg-secondary)', fontSize: 12, fontWeight: 600 },
    metricValue: { gridColumn: '1 / -1', alignSelf: 'end', fontSize: 27, lineHeight: 1, letterSpacing: '-.03em' },
    panel: { marginBottom: 16, padding: 19, border: '1px solid var(--surface-400)', borderRadius: 14, background: 'var(--surface-100)', boxShadow: 'var(--shadow-sm)' },
    panelHeader: { marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    panelTitle: { margin: 0, fontSize: 15, fontWeight: 700 },
    panelSubtitle: { margin: '4px 0 0', color: 'var(--fg-muted)', fontSize: 11 },
    emptyState: { minHeight: 90, padding: 15, display: 'flex', alignItems: 'center', gap: 13, border: '1px dashed var(--surface-400)', borderRadius: 11, background: 'var(--surface-200)' },
    emptyIcon: { width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 10, background: 'var(--warning-glow)', color: '#fbbf24' },
    emptyTitle: { fontSize: 13 },
    emptyCopy: { margin: '4px 0 0', color: 'var(--fg-secondary)', fontSize: 12 },
    insightList: { display: 'flex', flexDirection: 'column' },
    insight: { padding: '12px 2px', display: 'flex', gap: 11, borderTop: '1px solid var(--surface-300)' },
    insightTitle: { fontSize: 12 },
    insightDetail: { margin: '3px 0 0', color: 'var(--fg-secondary)', fontSize: 11, lineHeight: 1.45 },
    lowerGrid: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, .85fr)', gap: 16 },
    floorGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(70px, 1fr))', gap: 10 },
    table: { minHeight: 66, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, border: '1px solid var(--surface-400)', borderRadius: 12, background: 'var(--surface-200)', color: 'var(--fg-primary)', fontSize: 12, fontWeight: 700 },
    statusList: { display: 'flex', flexDirection: 'column', gap: 9 },
    statusRow: { minHeight: 49, padding: '0 13px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, background: 'var(--surface-200)', color: 'var(--fg-secondary)', fontSize: 12 },
    activityEmpty: { minHeight: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, color: 'var(--fg-muted)', fontSize: 12 },
    activityList: { display: 'flex', flexDirection: 'column' },
    activity: { padding: '11px 0', display: 'flex', alignItems: 'flex-start', gap: 10, borderTop: '1px solid var(--surface-300)' },
    activityDot: { width: 7, height: 7, marginTop: 5, borderRadius: '50%', background: '#60a5fa', flexShrink: 0 },
    activityLabel: { display: 'block', fontSize: 12 },
    activityDetail: { margin: '3px 0 0', color: 'var(--fg-secondary)', fontSize: 11 },
    itemTime: { color: 'var(--fg-muted)', fontSize: 10, whiteSpace: 'nowrap' },
};
