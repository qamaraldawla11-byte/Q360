import type { RestaurantOrder, User } from '../db/schema.js';

export const restaurantActions = [
    'create_order',
    'create_pay_now_takeaway_order',
    'mark_ready',
    'mark_delivered',
    'mark_collected',
    'record_payment',
    'cancel_order',
] as const;

export type RestaurantAction = typeof restaurantActions[number];
export type RestaurantOrderType = 'dine_in' | 'takeaway' | 'delivery';
export type RestaurantServiceStatus = 'pending' | 'in_kitchen' | 'ready' | 'delivered' | 'collected' | 'closed' | 'cancelled';
export type RestaurantPaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type RestaurantPaymentTiming = 'pay_before_service' | 'pay_after_service';

export type RestaurantActor = {
    userId: string;
    businessId: string;
    role?: string | null;
    legacyOwnerUser?: Pick<User, 'id' | 'role' | 'businessId' | 'userType' | 'segment' | 'onboardingCompleted' | 'primaryWorkspace'> | null;
};

export type RestaurantOrderLike = Pick<RestaurantOrder,
    'businessId' |
    'createdBy' |
    'orderType' |
    'tableId' |
    'status' |
    'serviceStatus' |
    'paymentStatus' |
    'paymentTiming'
>;

const waiterRoles = ['waiter', 'manager', 'owner', 'admin'] as const;
const kitchenRoles = ['kitchen', 'manager', 'owner', 'admin'] as const;
const paymentRoles = ['cashier', 'manager', 'owner', 'admin'] as const;
const orderCancelRoles = ['waiter', 'cashier', 'manager', 'owner', 'admin'] as const;

const hasRole = (actor: RestaurantActor, allowedRoles: readonly string[]) =>
    typeof actor.role === 'string' && allowedRoles.includes(actor.role);

export const isLegacyRestaurantOwnerCompatible = (actor: RestaurantActor) => {
    const user = actor.legacyOwnerUser;
    return Boolean(
        actor.role === 'user' &&
        user &&
        user.id === actor.userId &&
        user.businessId === actor.businessId &&
        user.role === 'user' &&
        user.userType === 'sme' &&
        user.segment === 'restaurant' &&
        user.onboardingCompleted === true &&
        user.primaryWorkspace === '/app/restaurant'
    );
};

export const orderTypeFor = (order: RestaurantOrderLike): RestaurantOrderType =>
    order.orderType ?? (order.tableId ? 'dine_in' : 'takeaway');

export const serviceStatusFor = (order: RestaurantOrderLike): RestaurantServiceStatus => {
    if (order.serviceStatus) return order.serviceStatus;
    if (order.status === 'cancelled') return 'cancelled';
    if (order.status === 'paid') return 'closed';
    if (order.status === 'served') return 'delivered';
    if (order.status === 'collected') return 'collected';
    if (order.status === 'closed') return 'closed';
    return order.status as RestaurantServiceStatus;
};

export const paymentTimingFor = (order: RestaurantOrderLike): RestaurantPaymentTiming =>
    order.paymentTiming ?? 'pay_after_service';

export const paymentStatusFor = (
    order: RestaurantOrderLike,
    completedPayment?: { id: string } | null,
): RestaurantPaymentStatus => {
    if (order.paymentStatus) return order.paymentStatus;
    return order.status === 'paid' || completedPayment ? 'paid' : 'unpaid';
};

export const isOrderPaid = (
    order: RestaurantOrderLike,
    completedPayment?: { id: string } | null,
) => paymentStatusFor(order, completedPayment) === 'paid' || order.status === 'paid';

export const isOrderClosedForCancellation = (
    serviceStatus: RestaurantServiceStatus,
    legacyStatus: string,
) => serviceStatus === 'closed' || legacyStatus === 'closed' || legacyStatus === 'cancelled';

export const legacyStatusFor = (
    orderType: RestaurantOrderType,
    serviceStatus: RestaurantServiceStatus,
    paymentStatus: RestaurantPaymentStatus,
): RestaurantOrder['status'] => {
    if (serviceStatus === 'cancelled') return 'cancelled';
    if (orderType === 'takeaway' && serviceStatus === 'closed') return 'closed';
    if (orderType === 'takeaway' && serviceStatus === 'collected' && paymentStatus === 'paid') return 'closed';
    if (orderType === 'delivery' && serviceStatus === 'delivered' && paymentStatus === 'paid') return 'closed';
    if (paymentStatus === 'paid' && serviceStatus === 'closed') return 'paid';
    if (serviceStatus === 'collected') return 'collected';
    if (orderType === 'dine_in' && serviceStatus === 'delivered' && paymentStatus === 'paid') return 'paid';
    return serviceStatus as RestaurantOrder['status'];
};

export type RestaurantTransitionResult =
    | { ok: true }
    | { ok: false; reason: 'cancelled' | 'already_done' | 'paid_before_delivery' | 'not_ready' | 'not_payable' | 'already_paid' | 'closed' };

export const validateRestaurantOrderTransition = (
    order: RestaurantOrderLike,
    action: RestaurantAction,
    completedPayment?: { id: string } | null,
): RestaurantTransitionResult => {
    const orderType = orderTypeFor(order);
    const serviceStatus = serviceStatusFor(order);
    const paymentStatus = paymentStatusFor(order, completedPayment);

    if (['mark_ready', 'mark_delivered', 'mark_collected', 'record_payment'].includes(action)) {
        if (serviceStatus === 'cancelled' || order.status === 'cancelled') return { ok: false, reason: 'cancelled' };
    }

    if (action === 'mark_ready') {
        if (serviceStatus === 'ready') return { ok: false, reason: 'already_done' };
        if (serviceStatus !== 'pending' && serviceStatus !== 'in_kitchen') return { ok: false, reason: 'not_ready' };
        return { ok: true };
    }

    if (action === 'mark_delivered') {
        if (serviceStatus === 'delivered') return { ok: false, reason: 'already_done' };
        if (!['dine_in', 'delivery'].includes(orderType) || serviceStatus !== 'ready') return { ok: false, reason: 'not_ready' };
        if (orderType === 'dine_in' && paymentStatus === 'paid') return { ok: false, reason: 'paid_before_delivery' };
        return { ok: true };
    }

    if (action === 'mark_collected') {
        if (serviceStatus === 'collected') return { ok: false, reason: 'already_done' };
        if (orderType !== 'takeaway' || serviceStatus !== 'ready') return { ok: false, reason: 'not_ready' };
        return { ok: true };
    }

    if (action === 'record_payment') {
        if (isOrderPaid(order, completedPayment)) return { ok: false, reason: 'already_paid' };
        const mustCompleteServiceBeforePayment = orderType === 'dine_in' || paymentTimingFor(order) === 'pay_after_service';
        if (mustCompleteServiceBeforePayment) {
            const isPayableAfterService = orderType === 'takeaway'
                ? serviceStatus === 'collected'
                : serviceStatus === 'delivered';
            if (!isPayableAfterService) return { ok: false, reason: 'not_payable' };
        }
        return { ok: true };
    }

    if (action === 'cancel_order') {
        if (paymentStatus === 'paid') return { ok: false, reason: 'already_paid' };
        if (isOrderClosedForCancellation(serviceStatus, order.status)) return { ok: false, reason: 'closed' };
        return { ok: true };
    }

    return { ok: true };
};

export const canPerformRestaurantAction = (
    actor: RestaurantActor,
    action: RestaurantAction,
    order?: RestaurantOrderLike,
) => {
    if (order && order.businessId !== actor.businessId) return false;
    const legacyOwner = isLegacyRestaurantOwnerCompatible(actor);
    const orderType = order ? orderTypeFor(order) : undefined;

    if (action === 'create_order') {
        return hasRole(actor, waiterRoles) || (orderType === 'takeaway' || orderType === 'delivery') && hasRole(actor, ['cashier']) || legacyOwner;
    }
    if (action === 'create_pay_now_takeaway_order') return hasRole(actor, paymentRoles) || legacyOwner;
    if (action === 'mark_ready') return hasRole(actor, kitchenRoles) || legacyOwner;
    if (action === 'mark_delivered') return hasRole(actor, waiterRoles) || legacyOwner;
    if (action === 'mark_collected') return hasRole(actor, paymentRoles) || legacyOwner;
    if (action === 'record_payment') return hasRole(actor, paymentRoles) || legacyOwner;
    if (action === 'cancel_order') {
        if (!order) return hasRole(actor, orderCancelRoles) || legacyOwner;
        const transition = validateRestaurantOrderTransition(order, action);
        if (!transition.ok) return false;
        if (actor.role === 'kitchen') return false;
        if (!hasRole(actor, orderCancelRoles)) return legacyOwner;
        if (actor.role === 'waiter') {
            return orderType === 'dine_in' && serviceStatusFor(order) === 'pending' && order.createdBy === actor.userId;
        }
        if (actor.role === 'cashier') {
            return (orderType === 'takeaway' || orderType === 'delivery') && serviceStatusFor(order) === 'pending';
        }
        return actor.role === 'manager' || actor.role === 'owner' || actor.role === 'admin';
    }
    return false;
};

export const getRestaurantNextAllowedActions = (
    actor: RestaurantActor,
    order: RestaurantOrderLike,
): RestaurantAction[] => {
    const activeActions: RestaurantAction[] = ['mark_ready', 'mark_delivered', 'mark_collected', 'record_payment'];
    return activeActions.filter((action) => (
        canPerformRestaurantAction(actor, action, order) &&
        validateRestaurantOrderTransition(order, action).ok
    ));
};
