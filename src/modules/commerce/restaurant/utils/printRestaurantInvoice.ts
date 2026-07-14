import type { BusinessProfile } from '@/api/business.api';
import type { RestaurantOrder, RestaurantTable } from '@/api/restaurant.api';

const escapeHtml = (value: string | number | null | undefined) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const money = (cents: number, currency: string) => new Intl.NumberFormat('en-GB', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(cents / 100);

const formatDate = (value: string, timezone?: string) => new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: timezone || undefined,
}).format(new Date(value));

export const printRestaurantInvoice = (
    order: RestaurantOrder,
    business: BusinessProfile | null,
    table?: RestaurantTable,
) => {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return false;

    const currency = business?.currency || 'USD';
    const payment = order.payments?.find((entry) => entry.status === 'completed');
    const isPaid = order.paymentStatus === 'paid';
    const documentType = isPaid ? 'Sales invoice' : 'Order summary';
    const invoiceNumber = (business?.publicCode || 'Q360') + '-' + order.displayOrderNumber.replace('#', '');
    const service = order.orderType === 'delivery'
        ? 'Delivery'
        : order.orderType === 'takeaway'
            ? 'Takeaway'
            : 'Dine-in' + (table ? ' · ' + table.label : '');
    const businessAddress = [business?.address, business?.city, business?.country]
        .filter(Boolean)
        .map(escapeHtml)
        .join('<br>') || 'Business address not set';
    const customerName = order.customerName || (order.orderType === 'dine_in' ? 'Walk-in customer' : 'Customer not recorded');
    const customerDetails = [order.customerPhone, order.deliveryAddress]
        .filter(Boolean)
        .map(escapeHtml)
        .join('<br>') || 'No customer contact details recorded';
    const lineRows = order.items.map((item, index) => (
        '<tr><td>' + (index + 1) + '</td><td><strong>' + escapeHtml(item.name) + '</strong>' +
        (item.notes ? '<small>' + escapeHtml(item.notes) + '</small>' : '') +
        '</td><td class="number">' + item.quantity + '</td><td class="number">' + money(item.unitPrice, currency) +
        '</td><td class="number">' + money(item.unitPrice * item.quantity, currency) + '</td></tr>'
    )).join('');
    const logo = business?.logoUrl
        ? '<img class="logo" src="' + escapeHtml(business.logoUrl) + '" alt="">'
        : '<div class="logo-fallback">Q</div>';
    const paidMessage = payment?.paidAt
        ? 'Payment received on ' + escapeHtml(formatDate(payment.paidAt, business?.timezone)) + '.'
        : 'Payment received.';

    popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' +
        escapeHtml(documentType) + ' ' + escapeHtml(order.displayOrderNumber) +
        '</title><style>@page{size:A4;margin:16mm}.page{font-family:Arial,Helvetica,sans-serif;color:#172033;max-width:760px;margin:0 auto}.top{display:flex;justify-content:space-between;gap:32px;padding-bottom:24px;border-bottom:2px solid #172033}.brand{display:flex;gap:14px;align-items:flex-start}.logo{width:54px;height:54px;border-radius:10px;object-fit:contain;border:1px solid #e3e7ee}.logo-fallback{display:grid;place-items:center;width:54px;height:54px;border-radius:10px;background:#172033;color:#fff;font-weight:800}.eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:#667085;font-weight:800;margin:0 0 5px}h1{font-size:27px;margin:0 0 6px}h2{font-size:16px;margin:0 0 8px}.muted{font-size:13px;line-height:1.55;color:#596579;margin:0}.invoice-title{text-align:right}.invoice-title strong{display:block;font-size:25px}.invoice-title span{font-size:13px;color:#596579}.details{display:grid;grid-template-columns:1fr 1fr;gap:22px;margin:28px 0}.box{padding:16px;border:1px solid #d9e0ea;border-radius:10px;min-height:94px}.box p{font-size:13px;line-height:1.55;margin:0;color:#344054}table{border-collapse:collapse;width:100%;font-size:13px}th{background:#172033;color:#fff;padding:11px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}td{padding:12px 10px;border-bottom:1px solid #e3e7ee;vertical-align:top}td small{display:block;color:#667085;margin-top:4px}.number{text-align:right;white-space:nowrap}.total{width:310px;margin:24px 0 0 auto}.total div{display:flex;justify-content:space-between;padding:8px 0;color:#475467;font-size:13px}.total .grand{border-top:2px solid #172033;margin-top:6px;padding-top:13px;color:#172033;font-size:18px;font-weight:800}.status{margin-top:28px;padding:13px 15px;border-radius:8px;font-size:13px;font-weight:700;background:' +
        (isPaid ? '#ecfdf3;color:#027a48' : '#fff7ed;color:#c2410c') +
        '}footer{margin-top:38px;padding-top:16px;border-top:1px solid #d9e0ea;color:#667085;font-size:11px;line-height:1.55}@media(max-width:600px){.top,.details{display:grid;grid-template-columns:1fr}.invoice-title{text-align:left}.total{width:100%}}</style></head><body><main class="page"><section class="top"><div class="brand">' +
        logo + '<div><p class="eyebrow">Supplier</p><h1>' + escapeHtml(business?.name || 'Q360 Restaurant') +
        '</h1><p class="muted">' + businessAddress +
        (business?.phone ? '<br>' + escapeHtml(business.phone) : '') +
        (business?.email ? '<br>' + escapeHtml(business.email) : '') +
        (business?.taxIdentifier ? '<br>Tax ID: ' + escapeHtml(business.taxIdentifier) : '') +
        '</p></div></div><div class="invoice-title"><p class="eyebrow">' + escapeHtml(documentType) +
        '</p><strong>' + escapeHtml(invoiceNumber) + '</strong><span>Order ' + escapeHtml(order.displayOrderNumber) +
        '<br>' + escapeHtml(formatDate(order.createdAt, business?.timezone)) +
        '</span></div></section><section class="details"><div class="box"><p class="eyebrow">Bill to</p><h2>' +
        escapeHtml(customerName) + '</h2><p>' + customerDetails +
        '</p></div><div class="box"><p class="eyebrow">Order details</p><p><strong>Service:</strong> ' +
        escapeHtml(service) + '<br><strong>Payment:</strong> ' +
        (isPaid ? 'Paid · ' + escapeHtml(payment?.method || 'recorded') : 'Payment pending') +
        '<br><strong>Reference:</strong> ' + escapeHtml(order.id.slice(0, 8).toUpperCase()) +
        '</p></div></section><table><thead><tr><th>#</th><th>Description</th><th class="number">Qty</th><th class="number">Unit price</th><th class="number">Line total</th></tr></thead><tbody>' +
        lineRows + '</tbody></table><section class="total"><div><span>Subtotal</span><span>' +
        money(order.total, currency) + '</span></div><div><span>VAT</span><span>' +
        money(0, currency) + '</span></div><div class="grand"><span>Total</span><span>' +
        money(order.total, currency) + '</span></div></section><div class="status">' +
        (isPaid ? paidMessage : 'Payment is still outstanding. This document is not a paid invoice.') +
        '</div><footer>Generated by Q360 · Currency: ' + escapeHtml(currency) +
        ' · VAT is shown as zero because no tax rate is configured for this business.</footer></main><script>window.onload=function(){window.print()}</script></body></html>');
    popup.document.close();
    return true;
};
