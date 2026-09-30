import { type ProductDetails, useCustomer, usePricingTable } from 'autumn-js/react';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from '@/utils/style-utils';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import CheckoutDialog from '@/components/autumn/checkout-dialog';
import { getPricingTableContent } from '@/lib/autumn/pricing-table-content';
import type { Product, ProductItem } from 'autumn-js';
import { Loader2 } from 'lucide-react';

// Wrapper component to memoize buttonProps
interface PricingCardWithButtonProps {
    product: Product;
    productId: string;
    checkout: ReturnType<typeof useCustomer>['checkout'];
}

const PricingCardMemoized = (props: Readonly<PricingCardWithButtonProps>) => {
    const { product, checkout, productId } = props;

    const handleClick = useCallback(async () => {
        if (product.id) {
            await checkout({
                dialog: CheckoutDialog, productId: product.id,
            });
        } else if (product.display?.button_url) {
            window.open(product.display?.button_url, '_blank', 'noopener,noreferrer');
        }
    }, [product.id, product.display?.button_url, checkout]);

    const buttonProps = useMemo(
        () => ({
            disabled: (product.scenario === 'active' && !product.properties.updateable) || product.scenario === 'scheduled',
            onClick: handleClick,
        }),
        [product.scenario, product.properties.updateable, handleClick],
    );

    return <PricingCard productId={productId} buttonProps={buttonProps} />;
};

interface PricingTableProps {
    productDetails?: ProductDetails[];
}

export default function PricingTable({ productDetails }: Readonly<PricingTableProps>) {
    const { checkout } = useCustomer();
    const [isAnnual, setIsAnnual] = useState(false);
    const { products, isLoading, error } = usePricingTable({ productDetails });

    if (isLoading) {
        return (
            <div className="w-full h-full flex justify-center items-center min-h-[300px]">
                <Loader2 className="w-6 h-6 text-zinc-400 animate-spin" />
            </div>
        );
    }

    if (error) {
        return <div> Something went wrong...</div>;
    }

    const intervals = Array.from(new Set(products?.map((p) => p.properties?.interval_group).filter((i) => !!i)));

    const multiInterval = intervals.length > 1;

    const intervalFilter = (product: Product) => {
        if (!product.properties?.interval_group) {
            return true;
        }

        if (multiInterval) {
            if (isAnnual) {
                return product.properties?.interval_group === 'year';
            } else {
                return product.properties?.interval_group === 'month';
            }
        }

        return true;
    };

    return (
        <div className={cn('root')}>
            {products && (
                <PricingTableContainer
                    products={products}
                    isAnnualToggle={isAnnual}
                    setIsAnnualToggle={setIsAnnual}
                    multiInterval={multiInterval}
                >
                    {products.filter(intervalFilter).map((product) => (
                        <PricingCardMemoized
                            key={product.id}
                            product={product}
                            productId={product.id}
                            checkout={checkout}
                        />
                    ))}
                </PricingTableContainer>
            )}
        </div>
    );
}

const PricingTableContext = createContext<{
    isAnnualToggle: boolean;
    setIsAnnualToggle: (isAnnual: boolean) => void;
    products: Product[];
    showFeatures: boolean;
}>({
    isAnnualToggle: false, products: [], setIsAnnualToggle: () => { }, showFeatures: true,
});

export const usePricingTableContext = (componentName: string) => {
    const context = useContext(PricingTableContext);

    if (context === undefined) {
        throw new Error(`${componentName} must be used within <PricingTable />`);
    }

    return context;
};

type PricingTableContainerProps = {
    children?: React.ReactNode;
    products?: Product[];
    showFeatures?: boolean;
    className?: string;
    isAnnualToggle: boolean;
    setIsAnnualToggle: (isAnnual: boolean) => void;
    multiInterval: boolean;
};

export const PricingTableContainer = ({
    children,
    products,
    showFeatures = true,
    className,
    isAnnualToggle,
    setIsAnnualToggle,
    multiInterval,
}: Readonly<PricingTableContainerProps>) => {
    const hasRecommended = products?.some((p) => p.display?.recommend_text);
    const contextValue = React.useMemo(
        () => ({ isAnnualToggle, products: products ?? [], setIsAnnualToggle, showFeatures }),
        [isAnnualToggle, setIsAnnualToggle, products, showFeatures],
    );

    if (!products) {
        throw new Error('products is required in <PricingTable />');
    }

    if (products.length === 0) {
        return <></>;
    }

    return (
        <PricingTableContext.Provider value={contextValue}>
            <div className={cn('flex items-center flex-col', hasRecommended && '!py-10')}>
                {multiInterval && (
                    <div className={cn(products.some((p) => p.display?.recommend_text) && 'mb-8')}>
                        <AnnualSwitch isAnnualToggle={isAnnualToggle} setIsAnnualToggle={setIsAnnualToggle} />
                    </div>
                )}
                <div
                    className={cn(
                        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] w-full gap-2',
                        className,
                    )}
                >
                    {children}
                </div>
            </div>
        </PricingTableContext.Provider>
    );
};

interface PricingCardProps {
    productId: string;
    showFeatures?: boolean;
    className?: string;
    onButtonClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    buttonProps?: React.ComponentProps<'button'>;
}

export const PricingCard = ({ productId, className, buttonProps }: Readonly<PricingCardProps>) => {
    const { products, showFeatures } = usePricingTableContext('PricingCard');

    const product = products.find((p) => p.id === productId);

    if (!product) {
        throw new Error(`Product with id ${productId} not found`);
    }

    const { name, display: productDisplay } = product;

    const { buttonText } = getPricingTableContent(product);

    const isRecommended = !!productDisplay?.recommend_text;
    const mainPriceDisplay = product.properties?.is_free
        ? {
            primary_text: 'Free',
        }
        : product.items[0].display;

    const featureItems = product.properties?.is_free ? product.items : product.items.slice(1);

    return (
        <div
            className={cn(
                ' w-full h-full py-6 text-foreground border rounded-lg shadow-sm max-w-xl',
                isRecommended &&
                'lg:-translate-y-6 lg:shadow-lg dark:shadow-zinc-800/80 lg:h-[calc(100%+48px)] bg-secondary/40',
                className,
            )}
        >
            {productDisplay?.recommend_text && <RecommendedBadge recommended={productDisplay?.recommend_text} />}
            <div className={cn('flex flex-col h-full flex-grow', isRecommended && 'lg:translate-y-6')}>
                <div className="h-full">
                    <div className="flex flex-col">
                        <div className="pb-4">
                            <h2 className="text-2xl font-semibold px-6 truncate">{productDisplay?.name || name}</h2>
                            {productDisplay?.description && (
                                <div className="text-sm text-muted-foreground px-6 h-8">
                                    <p className="line-clamp-2">{productDisplay?.description}</p>
                                </div>
                            )}
                        </div>
                        <div className="mb-2">
                            <h3 className="font-semibold h-16 flex px-6 items-center border-y mb-4 bg-secondary/40">
                                <div className="line-clamp-2">
                                    {mainPriceDisplay?.primary_text}{' '}
                                    {mainPriceDisplay?.secondary_text && (
                                        <span className="font-normal text-muted-foreground mt-1">
                                            {mainPriceDisplay?.secondary_text}
                                        </span>
                                    )}
                                </div>
                            </h3>
                        </div>
                    </div>
                    {showFeatures && featureItems.length > 0 && (
                        <div className="flex-grow px-6 mb-6">
                            <PricingFeatureList
                                items={featureItems}
                                everythingFrom={product.display?.everything_from}
                            />
                        </div>
                    )}
                </div>
                <div className={cn(' px-6 ', isRecommended && 'lg:-translate-y-12')}>
                    <PricingCardButton recommended={!!productDisplay?.recommend_text} {...buttonProps}>
                        {productDisplay?.button_text || buttonText}
                    </PricingCardButton>
                </div>
            </div>
        </div>
    );
};

// Pricing Feature List
type PricingFeatureListProps = {
    items: ProductItem[];
    everythingFrom?: string;
    className?: string;
};

export const PricingFeatureList = ({ items, everythingFrom, className }: Readonly<PricingFeatureListProps>) => {
    return (
        <div className={cn('flex-grow', className)}>
            {everythingFrom && <p className="text-sm mb-4">Everything from {everythingFrom}, plus:</p>}
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={`${item.display?.primary_text}-${index}`} className="flex items-start gap-2 text-sm">
                        <div className="flex flex-col">
                            <span>{item.display?.primary_text}</span>
                            {item.display?.secondary_text && (
                                <span className="text-sm text-muted-foreground">{item.display?.secondary_text}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// Pricing Card Button
export interface PricingCardButtonProps extends React.ComponentProps<'button'> {
    recommended?: boolean;
    buttonUrl?: string;
}

export const PricingCardButton = React.forwardRef<HTMLButtonElement, PricingCardButtonProps>(
    ({ recommended, children, className, onClick, ...props }, ref) => {
        const [loading, setLoading] = useState(false);

        const handleClick = useCallback(
            async (e: React.MouseEvent<HTMLButtonElement>) => {
                setLoading(true);
                try {
                    await onClick?.(e);
                } catch (error) {
                    console.error(error);
                } finally {
                    setLoading(false);
                }
            },
            [onClick],
        );

        return (
            <Button
                className={cn(
                    'w-full py-3 px-4 group overflow-hidden relative transition-all duration-300 hover:brightness-90 border rounded-lg',
                    className,
                )}
                {...props}
                variant={recommended ? 'default' : 'secondary'}
                ref={ref}
                disabled={loading || props.disabled}
                onClick={handleClick}
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <>
                        <div className="flex items-center justify-between w-full transition-transform duration-300 group-hover:translate-y-[-130%]">
                            <span>{children}</span>
                            <span className="text-sm">→</span>
                        </div>
                        <div className="flex items-center justify-between w-full absolute px-4 translate-y-[130%] transition-transform duration-300 group-hover:translate-y-0 mt-2 group-hover:mt-0">
                            <span>{children}</span>
                            <span className="text-sm">→</span>
                        </div>
                    </>
                )}
            </Button>
        );
    },
);
PricingCardButton.displayName = 'PricingCardButton';

// Annual Switch
type AnnualSwitchProps = {
    isAnnualToggle: boolean;
    setIsAnnualToggle: (isAnnual: boolean) => void;
};

export const AnnualSwitch = ({ isAnnualToggle, setIsAnnualToggle }: Readonly<AnnualSwitchProps>) => {
    return (
        <div className="flex items-center space-x-2 mb-4">
            <span className="text-sm text-muted-foreground">Monthly</span>
            <Switch id="annual-billing" checked={isAnnualToggle} onCheckedChange={setIsAnnualToggle} />
            <span className="text-sm text-muted-foreground">Annual</span>
        </div>
    );
};

type RecommendedBadgeProps = {
    recommended: string;
};

export const RecommendedBadge = ({ recommended }: Readonly<RecommendedBadgeProps>) => {
    return (
        <div className="bg-secondary absolute border text-muted-foreground text-sm font-medium lg:rounded-full px-3 lg:py-0.5 lg:top-4 lg:right-4 top-[-1px] right-[-1px] rounded-bl-lg">
            {recommended}
        </div>
    );
};
