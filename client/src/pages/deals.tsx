import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/ui/layout/header';
import { DealsTable } from '@/components/dashboard/deals-table';
import { DealForm } from '@/components/deals/deal-form';

export default function Deals() {
  const { t } = useTranslation();
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);

  const handleEditDeal = (dealId: string) => {
    // TODO: Fetch deal data by ID
    setEditingDeal({ id: dealId });
    setIsDealFormOpen(true);
  };

  const handleCloseDealForm = () => {
    setIsDealFormOpen(false);
    setEditingDeal(null);
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
        />
      </main>

      <DealForm
        isOpen={isDealFormOpen}
        onClose={handleCloseDealForm}
        deal={editingDeal}
      />
    </div>
  );
}
