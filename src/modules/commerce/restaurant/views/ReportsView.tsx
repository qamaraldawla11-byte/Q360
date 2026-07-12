import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, DollarSign, LoaderCircle, ReceiptText, ShoppingBag, Utensils } from 'lucide-react';
import { ModuleShell } from '@/components/shared/ModuleShell';
import { PageHeader } from '@/components/shared/PageHeader';
import { restaurantApi, type RestaurantDailyReport, type RestaurantOrderStatus } from '@/api/restaurant.api';

const todayInputValue = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatMoney = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatTime = (value: string) => new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
});

const statusLabels: Partial<Record<RestaurantOrderStatus, string>> = {
    pending: 'Pending',
    in_kitchen: 'In kitchen',
    ready: 'Ready',
    delivered: 'Delivered',
    served: 'Delivered',
    collected: 'Collected',
    closed: 'Closed',
    paid: 'Paid',
    cancelled: 'Cancelled',
};

const emptyReport = (date: string): RestaurantDailyReport => ({
    date,
    summary: {
        totalOrders: 0,
        paidOrders: 0,
        unpaidOpenOrders: 0,
        paidRevenueCents: 0,
        dineInOrders: 0,
        takeawayOrders: 0,
    },
    statusBreakdown: {},
    recentOrders: [],
});

const ReportCard = ({ title, value, helper, icon: Icon }: {
    title: string;
    value: string | number;
    helper?: string;
    icon: typeof ReceiptText;
}) => (
    <article className="restaurant-report-card">
        <div className="restaurant-report-card__icon">
            <Icon size={20} />
        </div>
        <div>
            <p className="restaurant-report-card__title">{title}</p>
            <strong className="restaurant-report-card__value">{value}</strong>
            {helper && <span>{helper}</span>}
        </div>
    </article>
);

export const ReportsView = () => {
    const [selectedDate, setSelectedDate] = useState(todayInputValue());
    const [report, setReport] = useState<RestaurantDailyReport>(() => emptyReport(todayInputValue()));
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const loadReport = useCallback(async (date: string) => {
        setIsLoading(true);
        setError('');
        try {
            setReport(await restaurantApi.getDailyReport(date));
        } catch {
            setReport(emptyReport(date));
            setError('Unable to load the daily report for this date.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadReport(selectedDate);
    }, [loadReport, selectedDate]);

    const statusRows = useMemo(() => (
        Object.entries(report.statusBreakdown)
            .sort(([a], [b]) => a.localeCompare(b))
    ), [report.statusBreakdown]);

    return (
        <ModuleShell>
            <PageHeader
                title="Daily Restaurant Report"
                subtitle="Read-only daily orders and paid revenue from persisted Restaurant records."
                actions={
                    <label className="restaurant-report-date">
                        <CalendarDays size={18} />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            aria-label="Report date"
                        />
                    </label>
                }
            />

            {error && <div className="restaurant-report-alert" role="alert">{error}</div>}

            {isLoading ? (
                <div className="restaurant-report-empty">
                    <LoaderCircle size={18} /> Loading daily report...
                </div>
            ) : (
                <div className="restaurant-report">
                    <section className="restaurant-report-grid" aria-label="Daily summary">
                        <ReportCard title="Total orders" value={report.summary.totalOrders} icon={ReceiptText} />
                        <ReportCard title="Paid orders" value={report.summary.paidOrders} icon={DollarSign} />
                        <ReportCard title="Unpaid/open" value={report.summary.unpaidOpenOrders} icon={ShoppingBag} />
                        <ReportCard
                            title="Paid revenue"
                            value={formatMoney(report.summary.paidRevenueCents)}
                            helper="Completed payment rows for this day"
                            icon={DollarSign}
                        />
                        <ReportCard title="Dine-in" value={report.summary.dineInOrders} icon={Utensils} />
                        <ReportCard title="Takeaway" value={report.summary.takeawayOrders} icon={ShoppingBag} />
                    </section>

                    <section className="restaurant-report-panels">
                        <article className="restaurant-report-panel">
                            <h2>Status breakdown</h2>
                            {statusRows.length ? (
                                <div className="restaurant-report-status-list">
                                    {statusRows.map(([status, count]) => (
                                        <div key={status}>
                                            <span>{statusLabels[status as RestaurantOrderStatus] ?? status}</span>
                                            <strong>{count}</strong>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="restaurant-report-muted">No order statuses for this day.</p>
                            )}
                        </article>

                        <article className="restaurant-report-panel">
                            <h2>Recent orders</h2>
                            {report.recentOrders.length ? (
                                <div className="restaurant-report-orders">
                                    {report.recentOrders.map((order) => (
                                        <div key={order.id} className="restaurant-report-order">
                                            <div>
                                                <strong>{order.displayOrderNumber}</strong>
                                                <span>{formatTime(order.createdAt)} - {order.orderType === 'dine_in' ? 'Dine-in' : 'Takeaway'}</span>
                                            </div>
                                            <div>
                                                <strong>{formatMoney(order.total)}</strong>
                                                <span>{statusLabels[order.status] ?? order.status} / {order.paymentStatus}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="restaurant-report-empty">
                                    No orders were created for {report.date}.
                                </div>
                            )}
                        </article>
                    </section>
                </div>
            )}

            <style>{`
                .restaurant-report {
                    display: grid;
                    gap: 24px;
                }

                .restaurant-report-date {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    min-height: 40px;
                    padding: 8px 12px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    background: #ffffff;
                    color: var(--fg-secondary);
                }

                .restaurant-report-date input {
                    border: 0;
                    color: #0f172a;
                    background: #ffffff;
                    font: inherit;
                    outline: 0;
                }

                .restaurant-report-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 16px;
                }

                .restaurant-report-card,
                .restaurant-report-panel {
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    background: #ffffff;
                    color: #0f172a;
                }

                .restaurant-report-card {
                    display: flex;
                    gap: 12px;
                    padding: 18px;
                    min-height: 110px;
                    align-items: flex-start;
                }

                .restaurant-report-card__icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    background: #fff7ed;
                    color: #c2410c;
                    flex: 0 0 auto;
                }

                .restaurant-report-card__title,
                .restaurant-report-card span,
                .restaurant-report-muted {
                    margin: 0;
                    color: #64748b;
                    font-size: 13px;
                }

                .restaurant-report-card__value {
                    display: block;
                    margin-top: 4px;
                    color: #0f172a;
                    font-size: 30px;
                    line-height: 1.05;
                    font-weight: 850;
                    font-variant-numeric: tabular-nums;
                    overflow-wrap: anywhere;
                }

                .restaurant-report-card span {
                    display: block;
                    margin-top: 3px;
                }

                .restaurant-report-panels {
                    display: grid;
                    grid-template-columns: minmax(240px, 0.7fr) minmax(0, 1.3fr);
                    gap: 16px;
                    align-items: start;
                }

                .restaurant-report-panel {
                    padding: 20px;
                }

                .restaurant-report-panel h2 {
                    margin: 0 0 16px;
                    color: #0f172a;
                    font-size: 18px;
                }

                .restaurant-report-status-list,
                .restaurant-report-orders {
                    display: grid;
                    gap: 10px;
                }

                .restaurant-report-status-list div,
                .restaurant-report-order {
                    display: flex;
                    justify-content: space-between;
                    gap: 12px;
                    padding: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    background: #f8fafc;
                    color: #0f172a;
                }

                .restaurant-report-order span {
                    display: block;
                    margin-top: 3px;
                    color: #64748b;
                    font-size: 13px;
                }

                .restaurant-report-order > div:last-child {
                    text-align: right;
                }

                .restaurant-report-empty,
                .restaurant-report-alert {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    min-height: 96px;
                    padding: 20px;
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    background: #ffffff;
                    color: #64748b;
                    text-align: center;
                }

                .restaurant-report-alert {
                    min-height: auto;
                    margin-bottom: 16px;
                    border-color: #fecaca;
                    background: #fef2f2;
                    color: #991b1b;
                }

                @media (max-width: 760px) {
                    .restaurant-report-panels {
                        grid-template-columns: 1fr;
                    }

                    .restaurant-report-order {
                        display: grid;
                    }

                    .restaurant-report-order > div:last-child {
                        text-align: left;
                    }
                }

                @media (max-width: 560px) {
                    .restaurant-report-grid {
                        grid-template-columns: 1fr;
                    }

                    .restaurant-report-card {
                        min-height: 96px;
                    }

                    .restaurant-report-date {
                        width: 100%;
                    }

                    .restaurant-report-date input {
                        width: 100%;
                    }
                }
            `}</style>
        </ModuleShell>
    );
};
