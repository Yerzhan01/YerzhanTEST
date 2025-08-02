import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Header } from '@/components/ui/layout/header';
import { DealsTable } from '@/components/dashboard/deals-table';
import { DealForm } from '@/components/deals/deal-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

export default function Deals() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (dealId: string) => {
      return apiRequest('DELETE', `/api/deals/${dealId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      toast({
        title: 'Сделка удалена',
        variant: 'default',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Ошибка',
        description: error.message || 'Не удалось удалить сделку',
        variant: 'destructive',
      });
    },
  });

  const handleEditDeal = async (dealId: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/api/deals/${dealId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const dealData = await response.json();
        setEditingDeal(dealData);
        setIsDealFormOpen(true);
      }
    } catch (error) {
      console.error('Failed to fetch deal:', error);
    }
  };

  const handleCloseDealForm = () => {
    setIsDealFormOpen(false);
    setEditingDeal(null);
  };

  const handleDeleteDeal = async (dealId: string) => {
    if (confirm('Вы уверены, что хотите удалить эту сделку?')) {
      deleteMutation.mutate(dealId);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('deals.title')}
        subtitle="Управление всеми сделками"
      />

      <main className="flex-1 overflow-y-auto p-6">
        <DealsTable
          onAddDeal={() => setIsDealFormOpen(true)}
          onEditDeal={handleEditDeal}
          onDeleteDeal={handleDeleteDeal}
        />
      </main>

      <Dialog open={isDealFormOpen} onOpenChange={setIsDealFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingDeal ? 'Редактировать сделку' : 'Создать сделку'}
            </DialogTitle>
          </DialogHeader>
          <DealForm
            deal={editingDeal}
            onSuccess={handleCloseDealForm}
            onCancel={handleCloseDealForm}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
