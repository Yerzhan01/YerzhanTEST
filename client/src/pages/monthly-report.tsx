import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Header } from '@/components/ui/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, TrendingUp, TrendingDown, DollarSign, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';

export default function MonthlyReport() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [selectedProject, setSelectedProject] = useState('all');

  // Check if user has access to reports
  const hasAccess = user?.role === 'admin' || user?.role === 'financist';

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="Месячный отчет"
          subtitle="Детальная отчетность по месяцам"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-500 text-lg font-medium">
                  {t('messages.accessDenied')}
                </p>
                <p className="text-gray-500 mt-2">
                  У вас нет прав доступа к отчетам.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Fetch monthly report data
  const { data: reportData = {}, isLoading } = useQuery({
    queryKey: ['/api/analytics/monthly-report', selectedYear, selectedMonth, selectedProject],
    enabled: hasAccess,
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);
  const months = [
    { value: '1', label: 'Январь' },
    { value: '2', label: 'Февраль' },
    { value: '3', label: 'Март' },
    { value: '4', label: 'Апрель' },
    { value: '5', label: 'Май' },
    { value: '6', label: 'Июнь' },
    { value: '7', label: 'Июль' },
    { value: '8', label: 'Август' },
    { value: '9', label: 'Сентябрь' },
    { value: '10', label: 'Октябрь' },
    { value: '11', label: 'Ноябрь' },
    { value: '12', label: 'Декабрь' },
  ];

  const formatCurrency = (value: number) => `₺${value.toLocaleString()}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title="Месячный отчет"
        subtitle="Полный анализ продаж, возвратов и чистой прибыли"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map(month => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все проекты</SelectItem>
                  <SelectItem value="amazon">Amazon</SelectItem>
                  <SelectItem value="shopify">Shopify</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Экспорт отчета
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-blue-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Валовая выручка
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(reportData.grossRevenue || 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Общие продажи за месяц
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <RotateCcw className="text-red-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Возвраты
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      -{formatCurrency(reportData.totalReturns || 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      По дате покупки
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="text-green-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Чистая выручка
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency((reportData.grossRevenue || 0) - (reportData.totalReturns || 0))}
                    </p>
                    <p className="text-xs text-gray-500">
                      Итого после возвратов
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <TrendingDown className="text-purple-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      % возвратов
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {reportData.grossRevenue > 0 
                        ? ((reportData.totalReturns / reportData.grossRevenue) * 100).toFixed(1)
                        : '0.0'
                      }%
                    </p>
                    <p className="text-xs text-gray-500">
                      От общего объема
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Report */}
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Сводка</TabsTrigger>
              <TabsTrigger value="sales">Продажи</TabsTrigger>
              <TabsTrigger value="returns">Возвраты</TabsTrigger>
              <TabsTrigger value="managers">По менеджерам</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Финансовая сводка за {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                      <span className="font-medium">Валовая выручка за месяц:</span>
                      <span className="text-lg font-bold text-blue-600">
                        {formatCurrency(reportData.grossRevenue || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                      <span className="font-medium">Возвраты (по дате покупки):</span>
                      <span className="text-lg font-bold text-red-600">
                        -{formatCurrency(reportData.totalReturns || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg border-2 border-green-200">
                      <span className="font-medium text-lg">Чистая выручка:</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency((reportData.grossRevenue || 0) - (reportData.totalReturns || 0))}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Детализация продаж</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Загрузка...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>Клиент</TableHead>
                          <TableHead>Проект</TableHead>
                          <TableHead>Программа</TableHead>
                          <TableHead>Менеджер</TableHead>
                          <TableHead>Сумма</TableHead>
                          <TableHead>Статус</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(reportData.sales || []).map((sale: any) => (
                          <TableRow key={sale.id}>
                            <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{sale.clientName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {sale.project === 'amazon' ? 'Amazon' : 'Shopify'}
                              </Badge>
                            </TableCell>
                            <TableCell>{sale.program}</TableCell>
                            <TableCell>{sale.manager?.fullName}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(parseFloat(sale.amount))}</TableCell>
                            <TableCell>
                              <Badge variant={sale.status === 'completed' ? 'success' : 'default'}>
                                {sale.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="returns" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Возвраты за период</CardTitle>
                  <p className="text-sm text-gray-500">
                    Показаны возвраты для сделок, совершенных в {months.find(m => m.value === selectedMonth)?.label} {selectedYear}, 
                    независимо от даты оформления возврата
                  </p>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Загрузка...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дата покупки</TableHead>
                          <TableHead>Дата возврата</TableHead>
                          <TableHead>Клиент</TableHead>
                          <TableHead>Программа</TableHead>
                          <TableHead>Сумма возврата</TableHead>
                          <TableHead>Причина</TableHead>
                          <TableHead>Статус</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(reportData.returns || []).map((returnItem: any) => (
                          <TableRow key={returnItem.id}>
                            <TableCell>{new Date(returnItem.deal.createdAt).toLocaleDateString()}</TableCell>
                            <TableCell>{new Date(returnItem.returnDate).toLocaleDateString()}</TableCell>
                            <TableCell>{returnItem.deal.clientName}</TableCell>
                            <TableCell>{returnItem.deal.program}</TableCell>
                            <TableCell className="font-medium text-red-600">
                              -{formatCurrency(parseFloat(returnItem.returnAmount))}
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate" title={returnItem.returnReason}>
                                {returnItem.returnReason}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={returnItem.status === 'completed' ? 'success' : 'default'}>
                                {returnItem.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="managers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Результаты менеджеров</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-8">Загрузка...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Менеджер</TableHead>
                          <TableHead>Проект</TableHead>
                          <TableHead>Валовая выручка</TableHead>
                          <TableHead>Возвраты</TableHead>
                          <TableHead>Чистая выручка</TableHead>
                          <TableHead>% возвратов</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(reportData.managerStats || []).map((manager: any) => (
                          <TableRow key={manager.id}>
                            <TableCell>{manager.fullName}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {manager.project === 'amazon' ? 'Amazon' : 'Shopify'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(manager.grossRevenue)}
                            </TableCell>
                            <TableCell className="text-red-600">
                              -{formatCurrency(manager.returns)}
                            </TableCell>
                            <TableCell className="font-medium text-green-600">
                              {formatCurrency(manager.grossRevenue - manager.returns)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={manager.returnRate > 15 ? 'destructive' : manager.returnRate > 10 ? 'default' : 'success'}>
                                {manager.returnRate.toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}