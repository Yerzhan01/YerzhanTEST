import { useTranslation } from 'react-i18next';
import { Header } from '@/components/ui/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Returns() {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('navigation.returns')}
        subtitle="Управление возвратами"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Модуль возвратов</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">
              Функционал модуля возвратов будет реализован в следующих итерациях.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
