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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Plan } from '@shared/schema';
import { Plus, Target, TrendingUp, Calendar, Users } from 'lucide-react';

interface PlanWithManager extends Plan {
  manager: {
    id: string;
    fullName: string;
    project: string;
  };
}

export default function Planning() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [newPlanOpen, setNewPlanOpen] = useState(false);

  // Form state
  const [planProject, setPlanProject] = useState<'amazon' | 'shopify'>('amazon');
  const [planManagerId, setPlanManagerId] = useState('');
  const [planType, setPlanType] = useState<'first_half' | 'second_half'>('first_half');
  const [plannedAmount, setPlannedAmount] = useState('');
  const [plannedDeals, setPlannedDeals] = useState('');

  // Check if user has access to planning
  const hasAccess = user?.role === 'admin';

  if (!hasAccess) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title={t('navigation.planning')}
          subtitle="Планирование и целевые показатели"
        />

        <main className="flex-1 overflow-y-auto p-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-red-500 text-lg font-medium">
                  {t('messages.accessDenied')}
                </p>
                <p className="text-gray-500 mt-2">
                  У вас нет прав доступа к планированию.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Fetch plans data
  const { data: plans = [], isLoading } = useQuery<PlanWithManager[]>({
    queryKey: ['/api/plans', selectedYear, selectedMonth, selectedProject],
    enabled: hasAccess,
  });

  // Fetch users for plan creation
  const { data: managers = [] } = useQuery({
    queryKey: ['/api/users'],
    select: (data: any) => data.filter((user: any) => user.role === 'manager'),
    enabled: hasAccess,
  });

  // Create plan mutation
  const createPlanMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/plans', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/plans'] });
      setNewPlanOpen(false);
      resetForm();
      toast({
        title: "Успешно",
        description: "План успешно создан",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать план",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setPlanProject('amazon');
    setPlanManagerId('');
    setPlanType('first_half');
    setPlannedAmount('');
    setPlannedDeals('');
  };

  const handleCreatePlan = () => {
    if (!planManagerId || !plannedAmount || !plannedDeals) {
      toast({
        title: "Ошибка",
        description: "Заполните все обязательные поля",
        variant: "destructive",
      });
      return;
    }

    createPlanMutation.mutate({
      project: planProject,
      managerId: planManagerId,
      planType,
      year: parseInt(selectedYear),
      month: parseInt(selectedMonth),
      plannedAmount: parseFloat(plannedAmount),
      plannedDeals: parseInt(plannedDeals),
    });
  };

  const formatCurrency = (value: string) => `₺${parseFloat(value).toLocaleString()}`;

  const getPlanProgress = (plan: PlanWithManager) => {
    // Mock calculation - in real app, this would be calculated from actual deals
    return Math.floor(Math.random() * 100);
  };

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('navigation.planning')}
        subtitle="Планирование и управление целевыми показателями"
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
            
            <Dialog open={newPlanOpen} onOpenChange={setNewPlanOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать план
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Создать план</DialogTitle>
                  <DialogDescription>
                    Создание нового плана для менеджера
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="project">Проект *</Label>
                    <Select value={planProject} onValueChange={(value: 'amazon' | 'shopify') => setPlanProject(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amazon">Amazon</SelectItem>
                        <SelectItem value="shopify">Shopify</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="manager">Менеджер *</Label>
                    <Select value={planManagerId} onValueChange={setPlanManagerId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите менеджера" />
                      </SelectTrigger>
                      <SelectContent>
                        {managers
                          .filter((manager: any) => manager.project === planProject)
                          .map((manager: any) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.fullName}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="planType">Тип плана *</Label>
                    <Select value={planType} onValueChange={(value: 'first_half' | 'second_half') => setPlanType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first_half">Первая половина месяца (1-15)</SelectItem>
                        <SelectItem value="second_half">Вторая половина месяца (16-30)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">Плановая сумма *</Label>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0.00 ₺"
                      value={plannedAmount}
                      onChange={(e) => setPlannedAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="deals">Количество сделок *</Label>
                    <Input
                      id="deals"
                      type="number"
                      placeholder="0"
                      value={plannedDeals}
                      onChange={(e) => setPlannedDeals(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setNewPlanOpen(false)}>
                    Отмена
                  </Button>
                  <Button onClick={handleCreatePlan} disabled={createPlanMutation.isPending}>
                    {createPlanMutation.isPending ? "Создание..." : "Создать"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Overview Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Target className="text-blue-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Общий план
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrency(plans.reduce((sum: number, plan: Plan) => sum + parseFloat(plan.plannedAmount), 0).toString())}
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
                      Среднее выполнение
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      87.5%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Calendar className="text-purple-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Активных планов
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {plans.filter((plan: Plan) => plan.isActive).length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Users className="text-orange-600 h-5 w-5" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-600">
                      Менеджеров в планах
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {new Set(plans.map((plan: Plan) => plan.managerId)).size}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plans Tabs */}
          <Tabs defaultValue="first_half" className="space-y-4">
            <TabsList>
              <TabsTrigger value="first_half">Первая половина месяца (1-15)</TabsTrigger>
              <TabsTrigger value="second_half">Вторая половина месяца (16-30)</TabsTrigger>
            </TabsList>

            <TabsContent value="first_half" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Планы на первую половину месяца</CardTitle>
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
                          <TableHead>Плановая сумма</TableHead>
                          <TableHead>Количество сделок</TableHead>
                          <TableHead>Выполнение</TableHead>
                          <TableHead>Прогресс</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plans
                          .filter((plan: PlanWithManager) => plan.planType === 'first_half')
                          .map((plan: PlanWithManager) => {
                            const progress = getPlanProgress(plan);
                            return (
                              <TableRow key={plan.id}>
                                <TableCell>
                                  <div className="font-medium">{plan.manager.fullName}</div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {plan.project === 'amazon' ? 'Amazon' : 'Shopify'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(plan.plannedAmount)}
                                </TableCell>
                                <TableCell>{plan.plannedDeals}</TableCell>
                                <TableCell>
                                  <Badge variant={progress >= 80 ? "default" : progress >= 60 ? "outline" : "destructive"}>
                                    {progress}%
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Progress value={progress} className="flex-1" />
                                    <span className="text-sm font-medium w-12">
                                      {progress}%
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="second_half" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Планы на вторую половину месяца</CardTitle>
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
                          <TableHead>Плановая сумма</TableHead>
                          <TableHead>Количество сделок</TableHead>
                          <TableHead>Выполнение</TableHead>
                          <TableHead>Прогресс</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plans
                          .filter((plan: PlanWithManager) => plan.planType === 'second_half')
                          .map((plan: PlanWithManager) => {
                            const progress = getPlanProgress(plan);
                            return (
                              <TableRow key={plan.id}>
                                <TableCell>
                                  <div className="font-medium">{plan.manager.fullName}</div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {plan.project === 'amazon' ? 'Amazon' : 'Shopify'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-medium">
                                  {formatCurrency(plan.plannedAmount)}
                                </TableCell>
                                <TableCell>{plan.plannedDeals}</TableCell>
                                <TableCell>
                                  <Badge variant={progress >= 80 ? "default" : progress >= 60 ? "outline" : "destructive"}>
                                    {progress}%
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center space-x-2">
                                    <Progress value={progress} className="flex-1" />
                                    <span className="text-sm font-medium w-12">
                                      {progress}%
                                    </span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
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