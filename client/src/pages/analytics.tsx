import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/ui/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Analytics() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Check if user has access to financial analytics
  const hasAccess = user?.role === 'admin' || user?.role === 'financist';

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={t('navigation.analytics')}
          subtitle="Финансовая аналитика"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-500 text-lg font-medium">
                  {t('messages.accessDenied')}
                </p>
                <p className="text-gray-500 mt-2">
                  У вас нет прав доступа к финансовой аналитике.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('navigation.analytics')}
        subtitle="Финансовая аналитика и отчеты"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Финансовая аналитика</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">
              Детальная финансовая аналитика будет реализована в следующих итерациях.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
