import { useEffect, useState } from 'react';
import { Card, CardBody, CardHeader, Button, Progress, Chip } from "@heroui/react";
import { Icon } from '../../shared/ui';
import { BillingAPI } from '@/shared/api';

interface SubscriptionData {
  subscription: {
    tier: 'free' | 'pro' | 'enterprise';
    status: 'active' | 'inactive' | 'cancelled';
    currentPeriodEnd?: string;
    limits: {
      maxUsers: number | null;
      maxDataVolumeGB: number | null;
      maxRetentionDays: number;
    };
  };
  usage: {
    users: number;
    dataVolumeGB: number;
  };
}

export default function SubscriptionPage() {
    const [data, setData] = useState<SubscriptionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setError(null);
            const res = await BillingAPI.getSubscription();
            setData(res.data);
        } catch (e: any) {
            console.error(e);
            setError(e.response?.data?.error || e.message || 'Unknown error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpgrade = async (tier: 'free' | 'pro' | 'enterprise') => {
        if (!confirm(`Are you sure you want to switch to ${tier.toUpperCase()}?`)) return;
        try {
            setLoading(true);
            await BillingAPI.subscribe(tier);
            await fetchData();
            alert('Subscription updated successfully!');
        } catch (e) {
            alert('Failed to update subscription');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8">Loading subscription info...</div>;
    if (error) return (
        <div className="p-8 flex flex-col gap-4">
            <div className="text-danger font-bold text-xl">Error loading subscription data</div>
            <div className="p-4 bg-default-100 dark:bg-default-50 rounded-md font-mono text-sm text-danger-500">
                {error}
            </div>
            <Button onPress={fetchData} color="primary" variant="flat" size="sm" className="w-fit">
                Retry
            </Button>
        </div>
    );
    if (!data) return <div className="p-8">No data available.</div>;

    const { subscription, usage } = data;
    const limits = subscription.limits;

    const userPercent = limits.maxUsers ? (usage.users / limits.maxUsers) * 100 : 0;
    const dataPercent = limits.maxDataVolumeGB ? (usage.dataVolumeGB / limits.maxDataVolumeGB) * 100 : 0;

    return (
        <div className="p-6 h-screen overflow-y-auto animate-fade-in">
             <div className="mb-6">
                <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-3">
                    <Icon.CreditCard className="w-8 h-8 text-primary"/> 
                    Subscription & Billing
                </h1>
                <p className="text-foreground/60 text-sm mt-1">Manage your plan and view usage.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Current Plan Card */}
                <Card className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-900/10 border-primary/20">
                    <CardHeader className="pb-0 pt-6 px-6 flex-col items-start">
                        <small className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Current Plan</small>
                        <h3 className="font-bold text-3xl font-display uppercase text-primary tracking-tight">{subscription.tier}</h3>
                    </CardHeader>
                    <CardBody className="overflow-visible py-6">
                        <div className="flex flex-col gap-2">
                            <Chip color={subscription.status === 'active' ? "success" : "danger"} variant="flat">
                                {subscription.status}
                            </Chip>
                            <p className="text-small text-default-500 mt-2">
                                Renewal: {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'Auto-renew'}
                            </p>
                        </div>
                    </CardBody>
                </Card>

                {/* Usage Stats */}
                <Card className="col-span-2 bg-white/5 border border-white/5">
                    <CardHeader className="pb-0 pt-6 px-6 flex-col items-start">
                         <h3 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em]">Resource Usage</h3>
                    </CardHeader>
                    <CardBody className="py-6 px-6 gap-6">
                        {/* Users */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm">Users</span>
                                <span className="text-sm text-default-500">{usage.users} / {limits.maxUsers === null ? '∞' : limits.maxUsers}</span>
                            </div>
                            <Progress 
                                value={limits.maxUsers === null ? 0 : userPercent} 
                                color={userPercent > 90 ? "danger" : "primary"}
                                className="max-w-md"
                            />
                        </div>

                        {/* Data Volume */}
                        <div>
                            <div className="flex justify-between mb-2">
                                <span className="text-sm">Data Volume (This Month)</span>
                                <span className="text-sm text-default-500">{usage.dataVolumeGB.toFixed(2)} GB / {limits.maxDataVolumeGB === null ? '∞' : limits.maxDataVolumeGB + ' GB'}</span>
                            </div>
                            <Progress 
                                value={limits.maxDataVolumeGB === null ? 0 : dataPercent} 
                                color={dataPercent > 90 ? "danger" : "primary"}
                                className="max-w-md"
                            />
                        </div>

                        {/* Retention */}
                        <div>
                             <div className="flex justify-between mb-2">
                                <span className="text-sm">Log Retention</span>
                                <span className="text-sm text-default-500">{limits.maxRetentionDays} Days</span>
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>

            <h2 className="text-[10px] font-bold font-display text-foreground/40 uppercase tracking-[0.2em] mb-4">Available Plans</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 {/* FREE */}
                 <PlanCard 
                    title="Free" 
                    price="$0/mo" 
                    features={['5 Users', '7 Days Retention', '5 GB/Month Data']}
                    current={subscription.tier === 'free'}
                    onSelect={() => handleUpgrade('free')}
                />
                 {/* PRO */}
                 <PlanCard 
                    title="Pro" 
                    price="$499/mo" 
                    features={['50 Users', '90 Days Retention', '100 GB/Month Data', 'Priority Support']}
                    featured
                    current={subscription.tier === 'pro'}
                    onSelect={() => handleUpgrade('pro')}
                />
                 {/* ENTERPRISE */}
                 <PlanCard 
                    title="Enterprise" 
                    price="Contact Sales" 
                    features={['Unlimited Users', '1 Year Retention', '1 TB/Month Data', 'Dedicated Success Manager']}
                    current={subscription.tier === 'enterprise'}
                    onSelect={() => handleUpgrade('enterprise')}
                />
            </div>
        </div>
    );
}

interface PlanCardProps {
    title: string;
    price: string;
    features: string[];
    featured?: boolean;
    current?: boolean;
    onSelect: () => void;
}

const PlanCard = ({ title, price, features, featured, current, onSelect }: PlanCardProps) => (
    <Card className={`border ${featured ? 'border-primary' : 'border-white/10'} bg-white/5`}>
        <CardHeader className="pb-0 pt-6 px-6 flex-col items-start gap-1">
             <h3 className="font-bold text-2xl font-display tracking-tight">{title}</h3>
             <p className="text-xl font-bold font-display text-foreground/50">{price}</p>
        </CardHeader>
        <CardBody className="py-6 px-6">
            <ul className="space-y-2 mb-6">
                {features.map((f: string, i: number) => (
                    <li key={i} className="flex gap-2 items-center text-sm">
                        <Icon.Check className="w-4 h-4 text-success" />
                        {f}
                    </li>
                ))}
            </ul>
             <Button 
                color={featured ? "primary" : "default"} 
                variant={current ? "flat" : "solid"}
                isDisabled={current}
                onPress={onSelect}
                className="w-full"
            >
                {current ? "Current Plan" : "Upgrade"}
            </Button>
        </CardBody>
    </Card>
);
