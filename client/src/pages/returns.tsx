import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/ui/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plus, FileText, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Return {
  id: string;
  dealId: string;
  returnDate: string;
  returnAmount: string;
  returnReason: string;
  status: 'requested' | 'processing' | 'completed' | 'rejected';
  createdAt: string;
  deal: {
    id: string;
    clientName: string;
    phone: string;
    project: string;
    program: string;
    amount: string;
  };
}

export default function Returns() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [newReturnOpen, setNewReturnOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState('');
  const [returnAmount, setReturnAmount] = useState('');
  const [returnReason, setReturnReason] = useState('');

  // Check if user has access to returns
  const hasAccess = user?.role === 'admin' || user?.role === 'financist';

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={t('navigation.returns')}
          subtitle="Управление возвратами"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-500 text-lg font-medium">
                  {t('messages.accessDenied')}
                </p>
                <p className="text-gray-500 mt-2">
                  У вас нет прав доступа к управлению возвратами.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Fetch returns data  
  const { data: returns = [], isLoading } = useQuery<Return[]>({
    queryKey: [selectedStatus === 'all' ? '/api/returns/all' : `/api/returns/${selectedStatus}`],
    enabled: hasAccess,
  });

  // Fetch deals for return creation
  const { data: deals = [] } = useQuery({
    queryKey: ['/api/deals'],
    select: (data: any) => data.deals || [],
    enabled: hasAccess,
  });

  // Create return mutation
  const createReturnMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/returns', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/returns'] });
      setNewReturnOpen(false);
      setSelectedDealId('');
      setReturnAmount('');
      setReturnReason('');
      toast({
        title: "Успешно",
        description: "Возврат успешно создан",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать возврат",
        variant: "destructive",
      });
    },
  });

  const handleCreateReturn = () => {
    if (!selectedDealId || !returnAmount || !returnReason) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля",
        variant: "destructive",
      });
      return;
    }

    const selectedDeal = deals.find((d: any) => d.id === selectedDealId);
    const maxAmount = parseFloat(selectedDeal?.paidAmount || '0');
    const requestedAmount = parseFloat(returnAmount);

    if (requestedAmount > maxAmount) {
      toast({
        title: "Ошибка",
        description: `Сумма возврата не может превышать оплаченную сумму (${formatCurrency(maxAmount.toString())})`,
        variant: "destructive",
      });
      return;
    }

    createReturnMutation.mutate({
      dealId: selectedDealId,
      returnDate: new Date().toISOString(),
      returnAmount: requestedAmount.toString(),
      returnReason,
      status: 'requested',
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      requested: { label: 'Запрошен', variant: 'outline' as const, icon: Clock },
      processing: { label: 'В обработке', variant: 'default' as const, icon: AlertCircle },
      completed: { label: 'Завершен', variant: 'default' as const, icon: CheckCircle },
      rejected: { label: 'Отклонен', variant: 'destructive' as const, icon: XCircle },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.requested;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (value: string) => `₺${parseFloat(value).toLocaleString()}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('navigation.returns')}
        subtitle="Управление возвратами и возмещениями"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="requested">Запрошенные</SelectItem>
                  <SelectItem value="processing">В обработке</SelectItem>
                  <SelectItem value="completed">Завершенные</SelectItem>
                  <SelectItem value="rejected">Отклоненные</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {user?.role === 'admin' && (
              <Dialog open={newReturnOpen} onOpenChange={setNewReturnOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать возврат
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Создать возврат</DialogTitle>
                    <DialogDescription>
                      Создание нового запроса на возврат
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="deal">Сделка *</Label>
                      <Select value={selectedDealId} onValueChange={setSelectedDealId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите сделку" />
                        </SelectTrigger>
                        <SelectContent>
                          {deals.map((deal: any) => (
                            <SelectItem key={deal.id} value={deal.id}>
                              {deal.clientName} - {deal.program} (Оплачено: {formatCurrency(deal.paidAmount || '0')})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="amount">Сумма возврата *</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00 ₺"
                        value={returnAmount}
                        onChange={(e) => setReturnAmount(e.target.value)}
                        max={selectedDealId ? deals.find((d: any) => d.id === selectedDealId)?.paidAmount || 0 : undefined}
                      />
                      {selectedDealId && (
                        <p className="text-xs text-gray-500 mt-1">
                          Максимум: {formatCurrency(deals.find((d: any) => d.id === selectedDealId)?.paidAmount || '0')} (оплаченная сумма)
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="reason">Причина возврата *</Label>
                      <Textarea
                        id="reason"
                        placeholder="Укажите причину возврата..."
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewReturnOpen(false)}>
                      Отмена
                    </Button>
                    <Button onClick={handleCreateReturn} disabled={createReturnMutation.isPending}>
                      {createReturnMutation.isPending ? "Создание..." : "Создать"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <FileText className="text-red-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Общая сумма возвратов
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency((returns as Return[]).reduce((sum: number, ret: Return) => sum + parseFloat(ret.returnAmount), 0).toString())}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Clock className="text-orange-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      В обработке
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(returns as Return[]).filter((ret: Return) => ret.status === 'processing').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <CheckCircle className="text-green-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Завершенные
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(returns as Return[]).filter((ret: Return) => ret.status === 'completed').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                    <XCircle className="text-gray-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Отклоненные
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(returns as Return[]).filter((ret: Return) => ret.status === 'rejected').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Returns Table */}
          <Card>
            <CardHeader>
              <CardTitle>Возвраты</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">Загрузка...</div>
              ) : returns.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Возвраты не найдены</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клиент</TableHead>
                      <TableHead>Проект</TableHead>
                      <TableHead>Программа</TableHead>
                      <TableHead>Сумма возврата</TableHead>
                      <TableHead>Причина</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Дата создания</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(returns as Return[]).map((returnItem: Return) => (
                      <TableRow key={returnItem.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{returnItem.deal.clientName}</div>
                            <div className="text-sm text-gray-500">{returnItem.deal.phone}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {returnItem.deal.project === 'amazon' ? 'Amazon' : 'Shopify'}
                          </Badge>
                        </TableCell>
                        <TableCell>{returnItem.deal.program}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(returnItem.returnAmount)}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate" title={returnItem.returnReason}>
                            {returnItem.returnReason}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(returnItem.status)}
                        </TableCell>
                        <TableCell>
                          {format(new Date(returnItem.createdAt), 'dd.MM.yyyy HH:mm')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}