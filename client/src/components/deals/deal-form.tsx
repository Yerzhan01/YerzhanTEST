import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

const dealSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  phone: z.string().min(1, 'Phone is required'),
  email: z.string().email().optional().or(z.literal('')),
  project: z.enum(['amazon', 'shopify']),
  program: z.string().min(1, 'Program is required'),
  managerId: z.string().optional(),
  status: z.enum(['new', 'in_progress', 'prepayment', 'partial', 'completed', 'cancelled', 'frozen']),
  amount: z.string().min(1, 'Amount is required'),
  paidAmount: z.string().default('0'),
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
  isOpen: boolean;
  onClose: () => void;
  deal?: any;
}

export function DealForm({ isOpen, onClose, deal }: DealFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const form = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: {
      clientName: deal?.clientName || '',
      phone: deal?.phone || '',
      email: deal?.email || '',
      project: deal?.project || 'amazon',
      program: deal?.program || '',
      managerId: deal?.managerId || user?.id || '',
      status: deal?.status || 'new',
      amount: deal?.amount || '',
      paidAmount: deal?.paidAmount || '0',
      source: deal?.source || '',
      marketingChannel: deal?.marketingChannel || '',
      paymentMethod: deal?.paymentMethod || '',
      gender: deal?.gender || undefined,
      clientSegment: deal?.clientSegment || '',
      comments: deal?.comments || '',
      bankOrderNumber: deal?.bankOrderNumber || '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DealFormData) => {
      const response = await apiRequest('POST', '/api/deals', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: t('messages.dealCreated'),
        variant: 'default',
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DealFormData) => {
      const response = await apiRequest('PUT', `/api/deals/${deal.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      toast({
        title: t('messages.dealUpdated'),
        variant: 'default',
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: DealFormData) => {
    if (deal) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const programOptions = {
    amazon: [
      { value: 'Amazon PRO', label: t('programs.amazon_pro') },
      { value: 'Amazon PRO+', label: t('programs.amazon_pro_plus') },
    ],
    shopify: [
      { value: 'Shopify Basic', label: t('programs.shopify_basic') },
      { value: 'Shopify Advanced', label: t('programs.shopify_advanced') },
    ],
  };

  const selectedProject = form.watch('project');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {deal ? t('deals.editDeal') : t('deals.addDeal')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="clientName">{t('deals.clientName')} *</Label>
              <Input
                id="clientName"
                {...form.register('clientName')}
                placeholder={t('deals.clientName')}
              />
              {form.formState.errors.clientName && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.clientName.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="phone">{t('deals.phone')} *</Label>
              <Input
                id="phone"
                {...form.register('phone')}
                placeholder="+7 (999) 123-45-67"
              />
              {form.formState.errors.phone && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="email">{t('deals.email')}</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                placeholder="client@example.com"
              />
              {form.formState.errors.email && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="project">{t('deals.project')} *</Label>
              <Select
                value={form.watch('project')}
                onValueChange={(value) => {
                  form.setValue('project', value as 'amazon' | 'shopify');
                  form.setValue('program', ''); // Reset program when project changes
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('deals.project')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="amazon">{t('projects.amazon')}</SelectItem>
                  <SelectItem value="shopify">{t('projects.shopify')}</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.project && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.project.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="program">{t('deals.program')} *</Label>
              <Select
                value={form.watch('program')}
                onValueChange={(value) => form.setValue('program', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('deals.program')} />
                </SelectTrigger>
                <SelectContent>
                  {programOptions[selectedProject]?.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.program && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.program.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="status">{t('deals.status')} *</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(value) => form.setValue('status', value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('deals.status')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">{t('status.new')}</SelectItem>
                  <SelectItem value="in_progress">{t('status.in_progress')}</SelectItem>
                  <SelectItem value="prepayment">{t('status.prepayment')}</SelectItem>
                  <SelectItem value="partial">{t('status.partial')}</SelectItem>
                  <SelectItem value="completed">{t('status.completed')}</SelectItem>
                  <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
                  <SelectItem value="frozen">{t('status.frozen')}</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.status && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.status.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="amount">{t('deals.amount')} *</Label>
              <Input
                id="amount"
                type="number"
                {...form.register('amount')}
                placeholder="0"
              />
              {form.formState.errors.amount && (
                <p className="text-red-500 text-sm mt-1">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="paidAmount">Оплачено</Label>
              <Input
                id="paidAmount"
                type="number"
                {...form.register('paidAmount')}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="source">Источник привлечения</Label>
              <Select
                value={form.watch('source') || ''}
                onValueChange={(value) => form.setValue('source', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите источник" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Сайт</SelectItem>
                  <SelectItem value="social">Социальные сети</SelectItem>
                  <SelectItem value="advertising">Реклама</SelectItem>
                  <SelectItem value="referral">Рекомендация</SelectItem>
                  <SelectItem value="cold_call">Холодный звонок</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="gender">Пол клиента</Label>
              <Select
                value={form.watch('gender') || ''}
                onValueChange={(value) => form.setValue('gender', value as 'male' | 'female')}
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

          <div>
            <Label htmlFor="comments">Комментарии</Label>
            <Textarea
              id="comments"
              {...form.register('comments')}
              placeholder="Дополнительная информация о сделке..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {deal ? t('common.save') : t('deals.addDeal')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
