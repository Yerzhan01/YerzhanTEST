import type { Deal, Return, Plan, User } from '@shared/schema';

export interface DealsResponse {
  deals: Deal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  searchBy?: string;
}

export interface DashboardMetrics {
  totalSales: number;
  totalDeals: number;
  activeDeals: number;
  conversionRate: number;
  averageDealSize: number;
}

export interface ChartDataPoint {
  date: string;
  amount: number;
  deals: number;
}