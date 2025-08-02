import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Edit, Trash, RefreshCw } from 'lucide-react';
import { SiAmazon, SiShopify } from 'react-icons/si';

interface DealsTableProps {
  onAddDeal?: () => void;
  onEditDeal?: (dealId: string) => void;
}

export function DealsTable({ onAddDeal, onEditDeal }: DealsTableProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [searchBy, setSearchBy] = useState('client');
  const [page, setPage] = useState(1);

  const { data: dealsResponse, isLoading, refetch, error } = useQuery({
    queryKey: ['deals', page, search, searchBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search, searchBy })
      });
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/deals?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response.json();
    },
    enabled: true,
    refetchOnWindowFocus: false,
    staleTime: 0,
    refetchInterval: false,
  });

  // Remove debug logging since deals are now working

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      new: { variant: 'secondary' as const, color: 'bg-yellow-100 text-yellow-800' },
      in_progress: { variant: 'default' as const, color: 'bg-blue-100 text-blue-800' },
      prepayment: { variant: 'secondary' as const, color: 'bg-orange-100 text-orange-800' },
      partial: { variant: 'secondary' as const, color: 'bg-orange-100 text-orange-800' },
      completed: { variant: 'default' as const, color: 'bg-green-100 text-green-800' },
      cancelled: { variant: 'destructive' as const, color: 'bg-red-100 text-red-800' },
      frozen: { variant: 'outline' as const, color: 'bg-gray-100 text-gray-800' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.new;
    
    return (
      <Badge variant={config.variant} className={config.color}>
        {t(`status.${status}`)}
      </Badge>
    );
  };

  const getProjectIcon = (project: string) => {
    if (project === 'amazon') return <SiAmazon className="h-4 w-4 text-orange-500" />;
    if (project === 'shopify') return <SiShopify className="h-4 w-4 text-green-600" />;
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const deals = dealsResponse?.deals || [];
  const pagination = dealsResponse?.pagination;
  
  console.log('Rendering deals:', deals.length, 'deals found');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Все сделки</CardTitle>
          <div className="flex items-center space-x-3">
            <Select value={searchBy} onValueChange={setSearchBy}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">По клиенту</SelectItem>
                <SelectItem value="phone">По номеру</SelectItem>
                <SelectItem value="manager">По менеджеру</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Input
                type="text"
                placeholder={
                  searchBy === 'client' ? 'Поиск по имени клиента...' :
                  searchBy === 'phone' ? 'Поиск по номеру телефона...' :
                  'Поиск по менеджеру...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 w-64"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            {onAddDeal && (
              <Button onClick={onAddDeal}>
                <Plus className="mr-2 h-4 w-4" />
                Добавить сделку
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('deals.clientName')}</TableHead>
                <TableHead>{t('deals.project')}</TableHead>
                <TableHead>{t('deals.status')}</TableHead>
                <TableHead>{t('deals.amount')}</TableHead>
                <TableHead>{t('deals.manager')}</TableHead>
                <TableHead>{t('deals.date')}</TableHead>
                <TableHead className="text-right">{t('deals.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deals.map((deal: any) => (
                <TableRow key={deal.id} className="hover:bg-gray-50">
                  <TableCell>
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {deal.clientName}
                      </div>
                      <div className="text-sm text-gray-500">
                        {deal.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {getProjectIcon(deal.project)}
                      <span className="ml-2 text-sm text-gray-900">
                        {t(`programs.${deal.program.toLowerCase().replace(/\s+/g, '_')}`)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(deal.status)}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    ₽{Number(deal.amount).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-gray-900">
                    {deal.manager?.fullName || 'N/A'}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(deal.createdAt).toLocaleDateString('ru-RU')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      {onEditDeal && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEditDeal(deal.id)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {pagination && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Показано {((pagination.page - 1) * pagination.limit) + 1} до {Math.min(pagination.page * pagination.limit, pagination.total)} из {pagination.total} результатов
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={pagination.page <= 1}
              >
                Назад
              </Button>
              <span className="text-sm">
                Страница {pagination.page} из {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(prev => Math.min(pagination.pages, prev + 1))}
                disabled={pagination.page >= pagination.pages}
              >
                Далее
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
