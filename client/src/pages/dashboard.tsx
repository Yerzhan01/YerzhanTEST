import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Header } from '@/components/ui/layout/header';
import { MetricsCards } from '@/components/dashboard/metrics-cards';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { ProjectComparison } from '@/components/dashboard/project-comparison';
import { DealsTable } from '@/components/dashboard/deals-table';
import { DealForm } from '@/components/deals/deal-form';
import { Button } from '@/components/ui/button';
import { SiAmazon, SiShopify } from 'react-icons/si';
import { PieChart } from 'lucide-react';

export default function Dashboard() {
  const { t } = useTranslation();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [isDealFormOpen, setIsDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<any>(null);

  const projectButtons = [
    { id: 'amazon', label: t('projects.amazon'), icon: SiAmazon },
    { id: 'shopify', label: t('projects.shopify'), icon: SiShopify },
    { id: '', label: t('projects.all'), icon: PieChart },
  ];

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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header
        title={t('dashboard.title')}
        subtitle={t('dashboard.subtitle')}
        actions={
          <div className="flex bg-gray-100 rounded-lg p-1">
            {projectButtons.map((project) => {
              const Icon = project.icon;
              const isActive = selectedProject === project.id;
              
              return (
                <Button
                  key={project.id}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setSelectedProject(project.id)}
                  className={isActive ? 'bg-white shadow-sm' : ''}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {project.label}
                </Button>
              );
            })}
          </div>
        }
      />

      <main className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Key Metrics */}
        <MetricsCards project={selectedProject || undefined} />

        {/* Charts and Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SalesChart project={selectedProject || undefined} />
          <ProjectComparison />
        </div>

        {/* Recent Deals Table */}
        <DealsTable 
          onEditDeal={handleEditDeal}
          onAddDeal={() => setIsDealFormOpen(true)}
          limit={5}
        />
      </main>

      {/* Deal Form Modal */}
      <DealForm
        isOpen={isDealFormOpen}
        onClose={handleCloseDealForm}
        deal={editingDeal}
      />
    </div>
  );
}
