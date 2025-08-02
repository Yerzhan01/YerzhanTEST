import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, Handshake, Undo, Target } from 'lucide-react';

interface MetricsCardsProps {
  project?: string;
}

export function MetricsCards({ project }: MetricsCardsProps) {
  const { t } = useTranslation();

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/analytics/dashboard', project],
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-6">
              <Skeleton className="h-12 w-12 rounded-lg mb-4" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: t('dashboard.monthSales'),
      value: `₺${metrics?.totalSales?.toLocaleString() || '0'}`,
      subtitle: '+12.5% к прошлому месяцу',
      icon: Coins,
      bgColor: 'bg-success',
    },
    {
      title: t('dashboard.totalDeals'),
      value: metrics?.totalDeals || '0',
      subtitle: '+8 за сегодня',
      icon: Handshake,
      bgColor: 'bg-primary',
    },
    {
      title: t('dashboard.returns'),
      value: `₺${metrics?.totalReturns?.toLocaleString() || '0'}`,
      subtitle: '7.5% от продаж',
      icon: Undo,
      bgColor: 'bg-warning',
    },
    {
      title: t('dashboard.planCompletion'),
      value: `${metrics?.planCompletion || 0}%`,
      subtitle: 'до конца месяца 12 дней',
      icon: Target,
      bgColor: 'bg-gray-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card key={index} className="border border-gray-100">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className={`w-12 h-12 ${card.bgColor} rounded-lg flex items-center justify-center`}>
                  <Icon className="text-white h-5 w-5" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">
                    {card.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {card.value}
                  </p>
                  <p className="text-xs text-success">
                    {card.subtitle}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
