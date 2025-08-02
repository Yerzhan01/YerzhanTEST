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
import { apiRequest } from '@/lib/queryClient';

const returnSchema = z.object({
  dealId: z.string().min(1, 'Выберите сделку'),
  returnAmount: z.string().min(1, 'Сумма возврата обязательна'),
  returnReason: z.string().min(1, 'Причина возврата обязательна'),
  returnDate: z.string().min(1, 'Дата возврата обязательна'),
});

type ReturnFormData = z.infer<typeof returnSchema>;

interface ReturnFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export function ReturnForm({ onSuccess, onCancel }: ReturnFormProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: deals } = useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/deals');
      return response.json();
    },
  });

  const form = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      dealId: '',
      returnAmount: '',
      returnReason: '',
      returnDate: new Date().toISOString().split('T')[0],
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ReturnFormData) => {
      const payload = {
        ...data,
        returnAmount: parseFloat(data.returnAmount),
        returnDate: new Date(data.returnDate),
      };

      return apiRequest('POST', '/api/returns', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      toast({
        title: 'Возврат создан',
        variant: 'default',
      });
      onSuccess();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось создать возврат',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ReturnFormData) => {
    saveMutation.mutate(data);
  };

  const availableDeals = deals?.deals?.filter((deal: any) => {
    // Managers can only create returns for their own deals
    if (user?.role === 'manager') {
      return deal.managerId === user.id;
    }
    return true;
  }) || [];

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <Label htmlFor="dealId">Сделка *</Label>
        <Select
          value={form.watch('dealId')}
          onValueChange={(value) => form.setValue('dealId', value)}
        >
          <SelectTrigger className={form.formState.errors.dealId ? 'border-red-500' : ''}>
            <SelectValue placeholder="Выберите сделку" />
          </SelectTrigger>
          <SelectContent>
            {availableDeals.map((deal: any) => (
              <SelectItem key={deal.id} value={deal.id}>
                {deal.clientName} - ₺{Number(deal.amount).toLocaleString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {form.formState.errors.dealId && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.dealId.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="returnAmount">Сумма возврата (₺) *</Label>
          <Input
            id="returnAmount"
            type="number"
            step="0.01"
            min="0"
            {...form.register('returnAmount')}
            className={form.formState.errors.returnAmount ? 'border-red-500' : ''}
          />
          {form.formState.errors.returnAmount && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.returnAmount.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="returnDate">Дата возврата *</Label>
          <Input
            id="returnDate"
            type="date"
            {...form.register('returnDate')}
            className={form.formState.errors.returnDate ? 'border-red-500' : ''}
          />
          {form.formState.errors.returnDate && (
            <p className="text-sm text-red-500 mt-1">{form.formState.errors.returnDate.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="returnReason">Причина возврата *</Label>
        <Textarea
          id="returnReason"
          {...form.register('returnReason')}
          placeholder="Укажите причину возврата"
          rows={3}
          className={form.formState.errors.returnReason ? 'border-red-500' : ''}
        />
        {form.formState.errors.returnReason && (
          <p className="text-sm text-red-500 mt-1">{form.formState.errors.returnReason.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Отмена
        </Button>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Создание...' : 'Создать возврат'}
        </Button>
      </div>
    </form>
  );
}