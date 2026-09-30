import PricingTable from '@/components/autumn/pricing-table';

export function Pricing() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-background to-muted/50">
            <div className="container mx-auto px-4 py-16">
                <div className="text-center mb-16">
                    <h1 className="text-4xl font-bold tracking-tight mb-4">Choose Your Plan</h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Select the perfect plan for your needs. Upgrade or downgrade at any time.
                    </p>
                </div>

                <PricingTable />
            </div>
        </div>
    );
}
