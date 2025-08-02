import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { SiAmazon, SiShopify } from 'react-icons/si';

export function ProjectComparison() {
  const { t } = useTranslation();

  const { data: comparison, isLoading } = useQuery({
    queryKey: ['/api/analytics/project-comparison'],
    enabled: true,
  });

  const { data: topManagers, isLoading: managersLoading } = useQuery({
    queryKey: ['/api/analytics/top-managers'],
    enabled: true,
  });

  if (isLoading || managersLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index}>
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
            <div className="mt-6 pt-6 border-t">
              <Skeleton className="h-4 w-24 mb-3" />
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <Skeleton className="w-8 h-8 rounded-full mr-3" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div>
                    <Skeleton className="h-4 w-16 mb-1" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const projectIcons = {
    amazon: SiAmazon,
    shopify: SiShopify,
  };

  const projectColors = {
    amazon: 'bg-orange-500',
    shopify: 'bg-green-600',
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.projectComparison')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {comparison?.map((project: any) => {
            const Icon = projectIcons[project.project as keyof typeof projectIcons];
            const colorClass = projectColors[project.project as keyof typeof projectColors];
            
            return (
              <div key={project.project}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    {Icon && <Icon className="mr-2 h-4 w-4" />}
                    <span className="text-sm font-medium text-gray-700">
                      {t(`projects.${project.project}`)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-gray-900">
                    ₺{project.totalAmount.toLocaleString()} ({project.percentage}%)
                  </span>
                </div>
                <Progress 
                  value={project.percentage} 
                  className="h-3"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            {t('dashboard.topManagers')}
          </h4>
          <div className="space-y-3">
            {topManagers?.map((manager: any) => {
              const initials = manager.fullName
                .split(' ')
                .map((name: string) => name[0])
                .join('')
                .toUpperCase();

              return (
                <div key={manager.id} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-medium">
                        {initials}
                      </span>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {manager.fullName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {manager.project ? t(`projects.${manager.project}`) : 'Все проекты'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      ₺{manager.totalSales.toLocaleString()}
                    </p>
                    <p className={`text-xs ${manager.planCompletion >= 100 ? 'text-green-600' : 'text-yellow-600'}`}>
                      {manager.planCompletion}% плана
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
