import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { Deal } from '@shared/schema';

const dealSchema = z.object({
  clientName: z.string().min(1, 'Имя клиента обязательно'),
  phone: z.string().min(1, 'Телефон обязателен'),
  email: z.string().email('Неверный email').optional().or(z.literal('')),
  project: z.enum(['amazon', 'shopify'], { required_error: 'Выберите проект' }),
  program: z.string().min(1, 'Выберите программу'),
  managerId: z.string().min(1, 'Выберите менеджера'),
  amount: z.string().min(1, 'Сумма обязательна').transform(val => parseFloat(val)),
  paidAmount: z.string().optional().transform(val => val ? parseFloat(val) : 0),
  source: z.string().optional(),
  marketingChannel: z.string().optional(),
  paymentMethod: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  clientSegment: z.string().optional(),
  comments: z.string().optional(),
  bankOrderNumber: z.string().optional(),
});

type DealFormData = z.infer<typeof dealSchema>;

interface DealFormProps {
  deal?: Deal;
  isOpen?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DealForm({ deal, isOpen = true, onClose, onSuccess, onCancel }: DealFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: managers } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/users');
      return response.json();
    },
  });

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      clientName: deal?.clientName || '',
      phone: deal?.phone || '',
      email: deal?.email || '',
      project: deal?.project || 'amazon',
      program: deal?.program || '',
      managerId: deal?.managerId || (user?.role === 'manager' ? user.id : ''),
      amount: deal?.amount ? deal.amount.toString() : '',
      paidAmount: deal?.paidAmount ? deal.paidAmount.toString() : '0',
      source: deal?.source || '',
      marketingChannel: deal?.marketingChannel || '',
      paymentMethod: deal?.paymentMethod || '',
      gender: deal?.gender || undefined,
      clientSegment: deal?.clientSegment || '',
      comments: deal?.comments || '',
      bankOrderNumber: deal?.bankOrderNumber || '',
    },
  });

  const selectedProject = form.watch('project');

  const saveMutation = useMutation({
    mutationFn: async (data: DealFormData) => {
      // Numbers are already converted by schema transform
      const payload = {
        ...data,
        remainingAmount: data.amount - (data.paidAmount || 0),
      };

      if (deal) {
        return apiRequest('PUT', `/api/deals/${deal.id}`, payload);
      } else {
        return apiRequest('POST', '/api/deals', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: deal ? 'Сделка обновлена' : 'Сделка создана',
        variant: 'default',
      });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось сохранить сделку',
        variant: 'destructive',
      });
    },
  });

  const getPrograms = (project: string) => {
    if (project === 'amazon') {
      return [
        { value: 'Amazon PRO', label: 'Amazon PRO' },
        { value: 'Amazon PRO+', label: 'Amazon PRO+' },
        { value: 'Amazon Business', label: 'Amazon Business' },
      ];
    }
    return [
      { value: 'Shopify Basic', label: 'Shopify Basic' },
      { value: 'Shopify Advanced', label: 'Shopify Advanced' },
      { value: 'Shopify Plus', label: 'Shopify Plus' },
    ];
  };

  const onSubmit = (data: DealFormData) => {
    saveMutation.mutate(data);
  };

  // Reset program when project changes
  useEffect(() => {
    form.setValue('program', '');
  }, [selectedProject, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{deal ? 'Редактировать сделку' : 'Создать новую сделку'}</DialogTitle>
          <DialogDescription>
            Заполните информацию о клиенте и параметрах сделки
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="clientName">Имя клиента *</Label>
          <Input
            id="clientName"
            {...form.register('clientName')}
            className={form.formState.errors.clientName ? 'border-red-500' : ''}
          />
          {form.formState.errors.clientName && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.clientName.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="phone">Телефон *</Label>
          <Input
            id="phone"
            {...form.register('phone')}
            className={form.formState.errors.phone ? 'border-red-500' : ''}
          />
          {form.formState.errors.phone && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.phone.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            {...form.register('email')}
            className={form.formState.errors.email ? 'border-red-500' : ''}
          />
          {form.formState.errors.email && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.email.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="project">Проект *</Label>
          <Select
            value={form.watch('project')}
            onValueChange={(value: 'amazon' | 'shopify') => form.setValue('project', value)}
          >
            <SelectTrigger className={form.formState.errors.project ? 'border-red-500' : ''}>
              <SelectValue placeholder="Выберите проект" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="amazon">Amazon</SelectItem>
              <SelectItem value="shopify">Shopify</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.project && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.project.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="program">Программа *</Label>
          <Select
            value={form.watch('program')}
            onValueChange={(value) => form.setValue('program', value)}
          >
            <SelectTrigger className={form.formState.errors.program ? 'border-red-500' : ''}>
              <SelectValue placeholder="Выберите программу" />
            </SelectTrigger>
            <SelectContent>
              {getPrograms(selectedProject).map((program) => (
                <SelectItem key={program.value} value={program.value}>
                  {program.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.program && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.program.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="managerId">Менеджер *</Label>
          <Select
            value={form.watch('managerId')}
            onValueChange={(value) => form.setValue('managerId', value)}
            disabled={user?.role === 'manager'}
          >
            <SelectTrigger className={form.formState.errors.managerId ? 'border-red-500' : ''}>
              <SelectValue placeholder="Выберите менеджера" />
            </SelectTrigger>
            <SelectContent>
              {managers
                ?.filter((manager: any) => 
                  manager.role === 'manager' && 
                  manager.project === selectedProject
                )
                .map((manager: any) => (
                  <SelectItem key={manager.id} value={manager.id}>
                    {manager.fullName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {form.formState.errors.managerId && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.managerId.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="amount">Сумма сделки (₺) *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            {...form.register('amount')}
            className={form.formState.errors.amount ? 'border-red-500' : ''}
          />
          {form.formState.errors.amount && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.amount.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="paidAmount">Оплачено (₺)</Label>
          <Input
            id="paidAmount"
            type="number"
            step="0.01"
            min="0"
            {...form.register('paidAmount')}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="source">Источник</Label>
          <Input
            id="source"
            {...form.register('source')}
            placeholder="Откуда узнал о нас"
          />
        </div>

        <div>
          <Label htmlFor="marketingChannel">Маркетинговый канал</Label>
          <Input
            id="marketingChannel"
            {...form.register('marketingChannel')}
            placeholder="Instagram, Google Ads, etc."
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="paymentMethod">Способ оплаты</Label>
          <Select
            value={form.watch('paymentMethod') || ''}
            onValueChange={(value) => form.setValue('paymentMethod', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите способ оплаты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bank_transfer">Банковский перевод</SelectItem>
              <SelectItem value="credit_card">Кредитная карта</SelectItem>
              <SelectItem value="cash">Наличные</SelectItem>
              <SelectItem value="crypto">Криптовалюта</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="gender">Пол клиента</Label>
          <Select
            value={form.watch('gender') || ''}
            onValueChange={(value: 'male' | 'female') => form.setValue('gender', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Выберите пол" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Мужской</SelectItem>
              <SelectItem value="female">Женский</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="clientSegment">Сегмент клиента</Label>
          <Input
            id="clientSegment"
            {...form.register('clientSegment')}
            placeholder="VIP, Standard, etc."
          />
        </div>

        <div>
          <Label htmlFor="bankOrderNumber">Номер банковского ордера</Label>
          <Input
            id="bankOrderNumber"
            {...form.register('bankOrderNumber')}
            placeholder="Номер ордера из банка"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="comments">Комментарии</Label>
        <Textarea
          id="comments"
          {...form.register('comments')}
          placeholder="Дополнительная информация о сделке"
          rows={3}
        />
      </div>

        </form>
        
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            type="submit" 
            disabled={saveMutation.isPending}
            onClick={form.handleSubmit(onSubmit)}
          >
            {saveMutation.isPending ? 'Сохранение...' : (deal ? 'Обновить' : 'Создать')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}