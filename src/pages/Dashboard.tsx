import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ShoppingBag, ShoppingCart, Users, TrendingUp } from 'lucide-react';
import { apiGet } from '../lib/api';
import { toast } from 'sonner';

type AdminSummary = {
  totals: {
    revenue: number;
    orders: number;
    products: number;
    customers: number;
  };
  monthly: {
    revenue: { current: number; previous: number; change_percent: number | null };
    orders: { current: number; previous: number; change_percent: number | null };
  };
};

const GBP = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
});

const Dashboard = () => {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const res = await apiGet<AdminSummary>('/admin/summary/');
        setData(res);
      } catch (err) {
        toast.error('Unable to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const cards = useMemo(() => {
    const totals = data?.totals;
    return [
      {
        title: 'Total Revenue',
        value: totals ? GBP.format(totals.revenue) : '—',
        change: null,
        icon: TrendingUp,
        color: 'text-green-600',
      },
      {
        title: 'Total Orders',
        value: totals ? totals.orders.toLocaleString() : '—',
        change: null,
        icon: ShoppingCart,
        color: 'text-blue-600',
      },
      {
        title: 'Total Products',
        value: totals ? totals.products.toLocaleString() : '—',
        change: null,
        icon: ShoppingBag,
        color: 'text-bronze',
      },
      {
        title: 'Total Customers',
        value: totals ? totals.customers.toLocaleString() : '—',
        change: null,
        icon: Users,
        color: 'text-purple-600',
      },
    ];
  }, [data]);

  const formatChange = (pct: number | null) => {
    if (pct === null || pct === undefined) return '—';
    const prefix = pct > 0 ? '+ ' : '';
    return `${prefix}${pct}% vs last month`;
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-serif font-bold text-espresso">Dashboard Overview</h2>
        <p className="text-muted-foreground">Welcome back to your store's control center.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{isLoading ? 'Loading…' : stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.change !== null ? formatChange(stat.change) : 'Live total'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">
              Order tracking visualization will appear here.
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">
              Category performance breakdown.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
