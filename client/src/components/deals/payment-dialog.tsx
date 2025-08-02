import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deal: any;
}

export function PaymentDialog({ isOpen, onClose, deal }: PaymentDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentAmount, setPaymentAmount] = useState('');

  const paymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      const newPaidAmount = Number(deal.paidAmount) + amount;
      const payload = {
        paidAmount: newPaidAmount,
        remainingAmount: Number(deal.amount) - newPaidAmount
      };
      
      return apiRequest('PUT', `/api/deals/${deal.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Платеж добавлен',
        description: `Доплата в размере ₺${Number(paymentAmount).toLocaleString()} успешно добавлена`,
        variant: 'default',
      });
      setPaymentAmount('');
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось добавить платеж',
        variant: 'destructive',
      });
    },
  });

  const handleAddPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast({
        title: 'Ошибка',
        description: 'Введите корректную сумму',
        variant: 'destructive',
      });
      return;
    }

    const maxPayment = Number(deal.amount) - Number(deal.paidAmount);
    if (amount > maxPayment) {
      toast({
        title: 'Ошибка',
        description: `Сумма доплаты не может превышать ₺${maxPayment.toLocaleString()}`,
        variant: 'destructive',
      });
      return;
    }

    paymentMutation.mutate(amount);
  };

  const remainingAmount = Number(deal?.amount || 0) - Number(deal?.paidAmount || 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить доплату</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600 mb-2">Информация о сделке:</div>
            <div className="space-y-1 text-sm">
              <div><strong>Клиент:</strong> {deal?.clientName}</div>
              <div><strong>Общая сумма:</strong> ₺{Number(deal?.amount || 0).toLocaleString()}</div>
              <div><strong>Уже оплачено:</strong> ₺{Number(deal?.paidAmount || 0).toLocaleString()}</div>
              <div><strong>Остаток к доплате:</strong> ₺{remainingAmount.toLocaleString()}</div>
            </div>
          </div>

          <div>
            <Label htmlFor="paymentAmount">Сумма доплаты (₺)</Label>
            <Input
              id="paymentAmount"
              type="number"
              step="0.01"
              min="0.01"
              max={remainingAmount}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Введите сумму доплаты"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button 
            onClick={handleAddPayment} 
            disabled={paymentMutation.isPending || !paymentAmount}
          >
            {paymentMutation.isPending ? 'Добавление...' : 'Добавить доплату'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}