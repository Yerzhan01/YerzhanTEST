import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/ui/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ReturnForm } from '@/components/returns/return-form';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus } from 'lucide-react';

export default function Returns() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isReturnFormOpen, setIsReturnFormOpen] = useState(false);

  // Check if user has access
  const hasAccess = user?.role === 'admin' || user?.role === 'financist' || user?.role === 'manager';

  const { data: returns, isLoading, error, refetch } = useQuery({
    queryKey: ['returns'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/returns/all', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    enabled: hasAccess,
  });

  const handleCloseReturnForm = () => {
    setIsReturnFormOpen(false);
  };

  const formatCurrency = (value: string | number) => 
    `₺${Number(value).toLocaleString()}`;

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      processed: { variant: 'default' as const, label: 'Обработан' },
      pending: { variant: 'secondary' as const, label: 'В обработке' },
      cancelled: { variant: 'destructive' as const, label: 'Отменен' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Возвраты"
          subtitle="Управление возвратами товаров"
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-500 text-lg font-medium">
                  Доступ запрещен
                </p>
                <p className="text-gray-500 mt-2">
                  У вас нет прав доступа для просмотра возвратов.
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
        title="Возвраты"
        subtitle="Управление возвратами товаров"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Список возвратов</CardTitle>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <Button onClick={() => setIsReturnFormOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Создать возврат
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="text-center py-8">
                <p className="text-red-500">Ошибка: {error.message}</p>
                <Button onClick={() => refetch()} className="mt-4">Повторить</Button>
              </div>
            )}

            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Сделка</TableHead>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Сумма возврата</TableHead>
                      <TableHead>Причина</TableHead>
                      <TableHead>Дата возврата</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Обработал</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(returns) && returns.length > 0 ? (
                      returns.map((returnItem: any) => (
                        <TableRow key={returnItem.id}>
                          <TableCell className="font-medium">
                            #{returnItem.deal?.id?.slice(-6) || 'N/A'}
                          </TableCell>
                          <TableCell>
                            {returnItem.deal?.clientName || 'Неизвестно'}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(returnItem.returnAmount)}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {returnItem.returnReason}
                          </TableCell>
                          <TableCell>
                            {new Date(returnItem.returnDate).toLocaleDateString('ru-RU')}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(returnItem.status)}
                          </TableCell>
                          <TableCell>
                            {returnItem.processedBy?.fullName || 'Система'}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Возвраты не найдены
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={isReturnFormOpen} onOpenChange={setIsReturnFormOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Создать возврат</DialogTitle>
            </DialogHeader>
            <ReturnForm
              onSuccess={handleCloseReturnForm}
              onCancel={handleCloseReturnForm}
            />
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}