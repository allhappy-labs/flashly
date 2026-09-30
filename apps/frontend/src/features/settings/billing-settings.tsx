import { startTransition, useActionState, useCallback, useOptimistic, useState } from 'react';
import { useCustomer } from 'autumn-js/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { AlertTriangle, CreditCard, ExternalLink, Loader2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CLIENT_ORIGIN } from '../auth/auth-constants';
import { getFormString } from '@/utils/form-helpers';
import { useTranslation } from 'react-i18next';

type BillingActionState = {
    success?: boolean;
    error?: string;
};

type Product = {
    id: string;
    status: string;
    name?: string;
    current_period_start?: number;
    current_period_end?: number;
    display?: {
        name?: string;
    };
    items?: Array<{
        type?: string;
        price?: number;
        interval?: string;
        display?: {
            primary_text?: string;
            secondary_text?: string;
        };
    }>;
    properties?: {
        interval_group?: string;
    };
};

type Invoice = {
    id: string;
    created: number;
    created_at: number;
    total: number;
    currency: string;
    status: string;
    stripe_id: string;
    hosted_invoice_url?: string;
};

type CustomerData = {
    products: Product[];
    invoices: Invoice[];
};

function isCustomerData(value: unknown): value is CustomerData {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const data = value as Record<string, unknown>;
    return Array.isArray(data.products) && Array.isArray(data.invoices);
}

const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
};

const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        currency: currency.toUpperCase(), style: 'currency',
    }).format(amount / 100);
};

const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
        case 'active':
            return 'bg-green-100 text-green-800 hover:bg-green-200';
        case 'canceled':
        case 'cancelled':
            return 'bg-red-100 text-red-800 hover:bg-red-200';
        case 'trialing':
            return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
        case 'past_due':
            return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
        default:
            return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
};

async function openBillingPortalAction(
    _prevState: BillingActionState,
    _formData: FormData,
    openBillingPortal: ReturnType<typeof useCustomer>['openBillingPortal'],
    translate: (key: string) => string,
): Promise<BillingActionState> {
    try {
        const result = await openBillingPortal();
        if (result.data && result.error === null) {
            // Success case - open billing portal URL in same tab
            toast.success(translate('web.billing.portalRedirect'));
            window.open(result.data.url, '_self', 'noopener,noreferrer');
            return { success: true };
        } else {
            // Error case - show the error message
            const errorMessage = result.error?.message || 'Failed to open billing portal';
            toast.error(errorMessage);
            return { error: errorMessage };
        }
    } catch (error) {
        console.error('Failed to open billing portal:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to open billing portal';
        toast.error(errorMessage);
        return { error: errorMessage };
    }
}

async function cancelSubscriptionAction(
    _prevState: BillingActionState,
    formData: FormData,
    cancel: ReturnType<typeof useCustomer>['cancel'],
    translate: (key: string) => string,
): Promise<BillingActionState> {
    const productId = getFormString(formData, 'productId');

    try {
        const result = await cancel({ productId });
        if (result.data && result.error === null) {
            toast.success(translate('web.billing.cancelSuccess'));
            return { success: true };
        } else {
            const errorMessage = result.error?.message || 'Failed to cancel subscription';
            toast.error(errorMessage);
            return { error: errorMessage };
        }
    } catch (error) {
        console.error('Failed to cancel subscription:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to cancel subscription';
        toast.error(errorMessage);
        return { error: errorMessage };
    }
}

export function BillingSettings() {
    const { t } = useTranslation();
    const { customer, openBillingPortal, cancel } = useCustomer({
        expand: ['invoices'],
    });
    const [showCancelDialog, setShowCancelDialog] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<string>('');

    // Type-safe customer data using type guard
    const customerData = isCustomerData(customer) ? customer : null;

    const [_portalState, openPortalAction, isPortalPending] = useActionState(
        (prevState: BillingActionState, formData: FormData) =>
            openBillingPortalAction(
                prevState,
                formData,
                () => openBillingPortal({ returnUrl: CLIENT_ORIGIN + '/billing' }),
                t,
            ),
        {},
    );

    const [_cancelState, cancelAction, isCancelPending] = useActionState(
        (prevState: BillingActionState, formData: FormData) => cancelSubscriptionAction(prevState, formData, cancel, t),
        {},
    );

    // Optimistic updates for subscription status
    const [optimisticSubscriptions, setOptimisticSubscriptions] = useOptimistic(
        customerData?.products ?? [],
        (currentSubs: Product[], cancelledProductId: string) =>
            currentSubs.map((sub) => (sub.id === cancelledProductId ? { ...sub, status: 'cancelled' } : sub)),
    );

    const handleCancelSubscription = useCallback((productId: string) => {
        setSelectedProduct(productId);
        setShowCancelDialog(true);
    }, []);

    const confirmCancellation = useCallback(
        (formData: FormData) => {
            // Add optimistic update
            startTransition(() => {
                setOptimisticSubscriptions(selectedProduct);
            });

            setShowCancelDialog(false);
            return cancelAction(formData);
        },
        [selectedProduct, cancelAction, setOptimisticSubscriptions],
    );

    const handleKeepSubscription = useCallback(() => {
        setShowCancelDialog(false);
    }, []);

    const createCancelHandler = useCallback(
        (productId: string) => () => {
            handleCancelSubscription(productId);
        },
        [handleCancelSubscription],
    );

    return (
        <div className="space-y-6">
            {/* Subscription Management */}
            <Card className="py-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        {t('web.billing.managementTitle')}
                    </CardTitle>
                    <CardDescription>
                        {t('web.billing.managementSubtitle')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Current Subscriptions */}
                    {optimisticSubscriptions && optimisticSubscriptions.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-medium">
                                {t('web.billing.currentSubscriptions')}
                            </h3>
                            {optimisticSubscriptions.map((product: Product, index: number) => (
                                <div
                                    key={product.id || `product-${index}`}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">{product.name}</span>
                                            <Badge className={getStatusColor(product.status)}>{product.status}</Badge>
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {product.current_period_start && product.current_period_end && (
                                                <span>
                                                    {t('web.billing.period', {
                                                        start: formatDate(product.current_period_start),
                                                        end: formatDate(product.current_period_end),
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                        {product.items &&
                                            product.items.length > 0 &&
                                            product.items[0].type === 'price' && (
                                                <div className="text-sm font-medium">
                                                    {formatAmount((product.items[0].price ?? 0) * 100, 'EUR')} /{' '}
                                                    {product.items[0].interval}
                                                </div>
                                            )}
                                    </div>
                                    {product.status === 'active' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={createCancelHandler(product.id)}
                                            disabled={isCancelPending}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            {t('common.cancel')}
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Billing Portal Button */}
                    <div className="pt-4">
                        <form action={openPortalAction}>
                            <Button type="submit" disabled={isPortalPending} className="flex items-center gap-2">
                                {isPortalPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ExternalLink className="h-4 w-4" />
                                )}
                                {t('web.billing.manageButton')}
                            </Button>
                        </form>
                    </div>
                </CardContent>
            </Card>

            {/* Invoice History */}
            {customerData?.invoices && customerData.invoices.length > 0 && (
                <Card className="py-6">
                    <CardHeader>
                        <CardTitle>
                            {t('web.billing.invoiceHistory')}
                        </CardTitle>
                        <CardDescription>
                            {t('web.billing.invoiceHistorySubtitle')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>
                                        {t('web.billing.date')}
                                    </TableHead>
                                    <TableHead>
                                        {t('web.billing.amount')}
                                    </TableHead>
                                    <TableHead>
                                        {t('web.billing.status')}
                                    </TableHead>
                                    <TableHead>
                                        {t('web.billing.actions')}
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {customerData.invoices.map((invoice: Invoice) => (
                                    <TableRow key={invoice.stripe_id}>
                                        <TableCell>{formatDate(invoice.created_at)}</TableCell>
                                        <TableCell>{formatAmount(invoice.total * 100, invoice.currency)}</TableCell>
                                        <TableCell>
                                            <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {invoice.hosted_invoice_url && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex items-center gap-2 w-fit whitespace-nowrap"
                                                    asChild
                                                >
                                                    <a
                                                        href={invoice.hosted_invoice_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        {t('web.billing.viewInvoice')}
                                                    </a>
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Cancellation Confirmation Dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            {t('web.billing.cancelTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('web.billing.cancelDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={handleKeepSubscription} disabled={isCancelPending}>
                            {t('web.billing.keepSubscription')}
                        </Button>
                        <form action={confirmCancellation}>
                            <input type="hidden" name="productId" value={selectedProduct} />
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={isCancelPending}
                                className="flex items-center gap-2"
                            >
                                {isCancelPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    t('web.billing.cancelButton')
                                )}
                            </Button>
                        </form>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
