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
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Users, Target, DollarSign, Calendar, Download } from 'lucide-react';

export default function Analytics() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [selectedProject, setSelectedProject] = useState('all');

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

  // Fetch analytics data
  const { data: overviewData = {}, isLoading: overviewLoading } = useQuery({
    queryKey: ['/api/analytics/overview', selectedPeriod, selectedProject],
  });

  const { data: revenueData = [], isLoading: revenueLoading } = useQuery({
    queryKey: ['/api/analytics/revenue-trend', selectedPeriod],
  });

  const { data: managersData = [], isLoading: managersLoading } = useQuery({
    queryKey: ['/api/analytics/managers-performance', selectedProject],
  });

  const { data: projectsData = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['/api/analytics/projects-comparison'],
  });

  const { data: conversionData = {}, isLoading: conversionLoading } = useQuery({
    queryKey: ['/api/analytics/conversion-funnel', selectedProject],
  });

  const { data: returnsData = [], isLoading: returnsLoading } = useQuery({
    queryKey: ['/api/analytics/returns-analysis', selectedPeriod],
  });

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  const formatCurrency = (value: number) => `₺${value.toLocaleString()}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('navigation.analytics')}
        subtitle="Детальная финансовая аналитика и отчеты"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-col sm:flex-row gap-4">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Последняя неделя</SelectItem>
                  <SelectItem value="month">Последний месяц</SelectItem>
                  <SelectItem value="quarter">Последний квартал</SelectItem>
                  <SelectItem value="year">Последний год</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="w-48">
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

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <DollarSign className="text-white h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Валовая выручка
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(overviewData.grossRevenue || 0)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Без учета возвратов
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                    <TrendingDown className="text-red-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Возвраты за период
                    </p>
                    <p className="text-2xl font-bold text-red-600">
                      -{formatCurrency(overviewData.totalReturns || 0)}
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
                    <Target className="text-green-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Чистая выручка
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency((overviewData.grossRevenue || 0) - (overviewData.totalReturns || 0))}
                    </p>
                    <div className="flex items-center mt-1">
                      {(overviewData.revenueGrowth || 0) >= 0 ? (
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                      )}
                      <p className={`text-xs ${(overviewData.revenueGrowth || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {Math.abs(overviewData.revenueGrowth || 0).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-success rounded-lg flex items-center justify-center">
                    <Target className="text-white h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Выполнение плана
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(overviewData.planCompletion || 0).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      Средний показатель
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-warning rounded-lg flex items-center justify-center">
                    <Users className="text-white h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Активных сделок
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {overviewData.activeDeals || 0}
                    </p>
                    <p className="text-xs text-gray-500">
                      В работе
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-gray-600 rounded-lg flex items-center justify-center">
                    <Calendar className="text-white h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Конверсия
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {(overviewData.conversionRate || 0).toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">
                      Общая конверсия
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analytics Tabs */}
          <Tabs defaultValue="revenue" className="space-y-4">
            <TabsList>
              <TabsTrigger value="revenue">Выручка</TabsTrigger>
              <TabsTrigger value="managers">Менеджеры</TabsTrigger>
              <TabsTrigger value="projects">Проекты</TabsTrigger>
              <TabsTrigger value="conversion">Конверсия</TabsTrigger>
              <TabsTrigger value="returns">Возвраты</TabsTrigger>
            </TabsList>

            {/* Revenue Tab */}
            <TabsContent value="revenue" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Динамика выручки</CardTitle>
                </CardHeader>
                <CardContent>
                  {revenueLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      Загрузка...
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={revenueData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip 
                          formatter={(value: any, name: string) => [
                            formatCurrency(value), 
                            name === 'grossRevenue' ? 'Валовая выручка' : 
                            name === 'returns' ? 'Возвраты' : 'Чистая выручка'
                          ]} 
                        />
                        <Line type="monotone" dataKey="grossRevenue" stroke="#3B82F6" strokeWidth={2} name="Валовая выручка" />
                        <Line type="monotone" dataKey="returns" stroke="#EF4444" strokeWidth={2} name="Возвраты" />
                        <Line type="monotone" dataKey="netRevenue" stroke="#10B981" strokeWidth={3} name="Чистая выручка" />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Managers Tab */}
            <TabsContent value="managers" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Производительность менеджеров</CardTitle>
                </CardHeader>
                <CardContent>
                  {managersLoading ? (
                    <div className="text-center py-8">Загрузка...</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Менеджер</TableHead>
                          <TableHead>Проект</TableHead>
                          <TableHead>Выручка</TableHead>
                          <TableHead>Сделки</TableHead>
                          <TableHead>Выполнение плана</TableHead>
                          <TableHead>Конверсия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {managersData.map((manager: any) => (
                          <TableRow key={manager.id}>
                            <TableCell>
                              <div className="font-medium">{manager.fullName}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {manager.project === 'amazon' ? 'Amazon' : 'Shopify'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatCurrency(manager.revenue || 0)}
                            </TableCell>
                            <TableCell>
                              {manager.dealsCount || 0}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Progress value={manager.planCompletion || 0} className="flex-1" />
                                <span className="text-sm font-medium">
                                  {(manager.planCompletion || 0).toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={manager.conversionRate >= 15 ? "success" : manager.conversionRate >= 10 ? "default" : "destructive"}>
                                {(manager.conversionRate || 0).toFixed(1)}%
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

            {/* Projects Tab */}
            <TabsContent value="projects" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Распределение по проектам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {projectsLoading ? (
                      <div className="h-64 flex items-center justify-center">
                        Загрузка...
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={projectsData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="revenue"
                          >
                            {projectsData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value: any) => formatCurrency(value)} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Сравнение проектов</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {projectsLoading ? (
                      <div className="h-64 flex items-center justify-center">
                        Загрузка...
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={projectsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis tickFormatter={(value) => formatCurrency(value)} />
                          <Tooltip formatter={(value: any) => [formatCurrency(value), 'Выручка']} />
                          <Bar dataKey="revenue" fill="#3B82F6" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Conversion Tab */}
            <TabsContent value="conversion" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Воронка конверсии</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg">
                      <span className="font-medium">Лиды</span>
                      <span className="text-lg font-bold">{conversionData.leads || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                      <span className="font-medium">Контакты</span>
                      <span className="text-lg font-bold">{conversionData.contacts || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-yellow-50 rounded-lg">
                      <span className="font-medium">Переговоры</span>
                      <span className="text-lg font-bold">{conversionData.negotiations || 0}</span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                      <span className="font-medium">Завершенные сделки</span>
                      <span className="text-lg font-bold">{conversionData.completed || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Returns Tab */}
            <TabsContent value="returns" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Анализ возвратов</CardTitle>
                </CardHeader>
                <CardContent>
                  {returnsLoading ? (
                    <div className="h-64 flex items-center justify-center">
                      Загрузка...
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={returnsData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis tickFormatter={(value) => formatCurrency(value)} />
                        <Tooltip formatter={(value: any) => [formatCurrency(value), 'Возвраты']} />
                        <Bar dataKey="amount" fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
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