import { 
  users, 
  deals, 
  returns, 
  plans,
  type User, 
  type InsertUser, 
  type UpdateUser,
  type Deal,
  type InsertDeal,
  type UpdateDeal,
  type Return,
  type InsertReturn,
  type UpdateReturn,
  type Plan,
  type InsertPlan,
  type UpdatePlan,
  type DealWithManager,
  type ReturnWithDeal,
  type PlanWithManager
} from "@shared/schema";
import { 
  USER_ROLES, 
  PROJECTS, 
  DEAL_STATUSES, 
  RETURN_STATUSES,
  PLAN_TYPES,
  GENDERS,
  projectToId,
  dealStatusToId,
  returnStatusToId,
  projectToString,
  dealStatusToString,
  returnStatusToString,
  genderToString,
  type ProjectString,
  type DealStatusString,
  type ReturnStatusString
} from "@shared/mappers";
import { db } from "./db";
import { eq, and, gte, lte, desc, asc, sql, count } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  updateUser(id: string, updateUser: UpdateUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Deal methods
  getDeal(id: string): Promise<DealWithManager | undefined>;
  getDeals(filters: any): Promise<DealWithManager[]>;
  getDealsCount(filters: any): Promise<number>;
  createDeal(insertDeal: InsertDeal): Promise<Deal>;
  updateDeal(id: string, updateDeal: UpdateDeal): Promise<Deal>;
  deleteDeal(id: string): Promise<void>;

  // Return methods
  getReturns(filters: any): Promise<ReturnWithDeal[]>;
  createReturn(insertReturn: InsertReturn): Promise<Return>;
  updateReturn(id: string, updateReturn: UpdateReturn): Promise<Return>;

  // Plan methods
  getPlans(filters: any): Promise<PlanWithManager[]>;
  createPlan(insertPlan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, updatePlan: UpdatePlan): Promise<Plan>;

  // Analytics methods
  getDashboardMetrics(filters: any): Promise<any>;
  getSalesChartData(filters: any): Promise<any[]>;
  getProjectComparison(): Promise<any[]>;
  getTopManagers(limit: number): Promise<any[]>;
  getAnalyticsOverview(filters: any): Promise<any>;
  getRevenueTrend(period: string): Promise<any[]>;
  getManagersPerformance(project?: string): Promise<any[]>;
  getProjectsComparison(): Promise<any[]>;
  getConversionFunnel(project?: string): Promise<any>;
  getReturnsAnalysis(period: string): Promise<any[]>;
  getMonthlyReport(filters: any): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updateUser: UpdateUser): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updateUser, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.fullName));
  }

  async getDeal(id: string): Promise<DealWithManager | undefined> {
    const [deal] = await db
      .select()
      .from(deals)
      .leftJoin(users, eq(deals.managerId, users.id))
      .leftJoin(returns, eq(returns.dealId, deals.id))
      .where(eq(deals.id, id));
    
    if (!deal) return undefined;

    return {
      ...deal.deals,
      manager: deal.users!,
      returns: [] // TODO: Properly aggregate returns
    };
  }

  async getDeals(filters: any): Promise<DealWithManager[]> {
    // Build conditions first
    const conditions = [];
    
    if (filters.managerId) {
      conditions.push(eq(deals.managerId, filters.managerId));
    }
    
    if (filters.project) {
      conditions.push(eq(deals.project, filters.project));
    }
    
    if (filters.status) {
      conditions.push(eq(deals.status, filters.status));
    }
    
    if (filters.dateFrom) {
      conditions.push(gte(deals.createdAt, filters.dateFrom));
    }
    
    if (filters.dateTo) {
      conditions.push(lte(deals.createdAt, filters.dateTo));
    }
    
    // Add search functionality
    if (filters.search && filters.searchBy) {
      if (filters.searchBy === 'client') {
        conditions.push(sql`LOWER(${deals.clientName}) LIKE LOWER(${'%' + filters.search + '%'})`);
      } else if (filters.searchBy === 'phone') {
        conditions.push(sql`${deals.phone} LIKE ${'%' + filters.search + '%'}`);
      } else if (filters.searchBy === 'manager') {
        conditions.push(sql`LOWER(${users.fullName}) LIKE LOWER(${'%' + filters.search + '%'})`);
      }
    }

    // Build query step by step to avoid TypeScript issues
    const query = db
      .select()
      .from(deals)
      .leftJoin(users, eq(deals.managerId, users.id))
      .orderBy(desc(deals.createdAt))
      .$dynamic();
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    if (filters.limit) {
      query.limit(filters.limit);
    }
    
    if (filters.offset) {
      query.offset(filters.offset);
    }

    const results = await query;
    return results.map(result => ({
      ...result.deals,
      manager: result.users!,
      returns: []
    }));
  }

  async getDealsCount(filters: any): Promise<number> {
    const conditions = [];
    
    if (filters.managerId) {
      conditions.push(eq(deals.managerId, filters.managerId));
    }
    
    if (filters.project) {
      conditions.push(eq(deals.project, filters.project));
    }
    
    if (filters.status) {
      conditions.push(eq(deals.status, filters.status));
    }
    
    if (filters.dateFrom) {
      conditions.push(gte(deals.createdAt, filters.dateFrom));
    }
    
    if (filters.dateTo) {
      conditions.push(lte(deals.createdAt, filters.dateTo));
    }
    
    let query;
    
    // Add search functionality that requires join
    if (filters.search && filters.searchBy === 'manager') {
      query = db
        .select({ count: count() })
        .from(deals)
        .leftJoin(users, eq(deals.managerId, users.id));
      
      conditions.push(sql`LOWER(${users.fullName}) LIKE LOWER(${'%' + filters.search + '%'})`);
    } else {
      query = db.select({ count: count() }).from(deals);
      
      // Add search functionality for client and phone
      if (filters.search && filters.searchBy) {
        if (filters.searchBy === 'client') {
          conditions.push(sql`LOWER(${deals.clientName}) LIKE LOWER(${'%' + filters.search + '%'})`);
        } else if (filters.searchBy === 'phone') {
          conditions.push(sql`${deals.phone} LIKE ${'%' + filters.search + '%'}`);
        }
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    const [result] = await query;
    return result.count;
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const [deal] = await db
      .insert(deals)
      .values({
        ...insertDeal,
        remainingAmount: String(Number(insertDeal.amount) - Number(insertDeal.paidAmount || 0))
      })
      .returning();
    return deal;
  }

  async updateDeal(id: string, updateDeal: UpdateDeal): Promise<Deal> {
    // Автоматически пересчитываем остаток при обновлении сумм
    const updateData = { ...updateDeal, updatedAt: new Date() };
    
    if (updateDeal.amount !== undefined || updateDeal.paidAmount !== undefined) {
      const currentDeal = await this.getDeal(id);
      if (currentDeal) {
        const newAmount = updateDeal.amount !== undefined ? Number(updateDeal.amount) : Number(currentDeal.amount);
        const newPaidAmount = updateDeal.paidAmount !== undefined ? Number(updateDeal.paidAmount) : Number(currentDeal.paidAmount);
        updateData.remainingAmount = String(newAmount - newPaidAmount);
      }
    }

    const [deal] = await db
      .update(deals)
      .set(updateData)
      .where(eq(deals.id, id))
      .returning();
    return deal;
  }

  async deleteDeal(id: string): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getReturns(filters: any): Promise<ReturnWithDeal[]> {
    const conditions = [];
    
    if (filters.status) {
      conditions.push(eq(returns.status, filters.status));
    }
    
    if (filters.dateFrom) {
      conditions.push(gte(returns.returnDate, filters.dateFrom));
    }
    
    if (filters.dateTo) {
      conditions.push(lte(returns.returnDate, filters.dateTo));
    }

    const query = db
      .select()
      .from(returns)
      .leftJoin(deals, eq(returns.dealId, deals.id))
      .leftJoin(users, eq(returns.processedBy, users.id))
      .orderBy(desc(returns.createdAt))
      .$dynamic();
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    if (filters.limit) {
      query.limit(filters.limit);
    }
    
    if (filters.offset) {
      query.offset(filters.offset);
    }

    const results = await query;
    return results.map(result => ({
      ...result.returns,
      deal: result.deals!,
      processedBy: result.users || undefined
    })) as ReturnWithDeal[];
  }

  async createReturn(insertReturn: InsertReturn): Promise<Return> {
    const [returnRecord] = await db
      .insert(returns)
      .values(insertReturn)
      .returning();
    return returnRecord;
  }

  async updateReturn(id: string, updateReturn: UpdateReturn): Promise<Return> {
    const [returnRecord] = await db
      .update(returns)
      .set({ ...updateReturn, updatedAt: new Date() })
      .where(eq(returns.id, id))
      .returning();
    return returnRecord;
  }

  async getPlans(filters: any): Promise<PlanWithManager[]> {
    const conditions = [];
    
    if (filters.managerId) {
      conditions.push(eq(plans.managerId, filters.managerId));
    }
    
    if (filters.project) {
      conditions.push(eq(plans.project, filters.project));
    }
    
    if (filters.year) {
      conditions.push(eq(plans.year, filters.year));
    }
    
    if (filters.month) {
      conditions.push(eq(plans.month, filters.month));
    }

    const query = db
      .select()
      .from(plans)
      .leftJoin(users, eq(plans.managerId, users.id))
      .orderBy(desc(plans.year), desc(plans.month))
      .$dynamic();
    
    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    if (filters.limit) {
      query.limit(filters.limit);
    }
    
    if (filters.offset) {
      query.offset(filters.offset);
    }

    const results = await query;
    return results.map(result => ({
      ...result.plans,
      manager: result.users!
    }));
  }

  async createPlan(insertPlan: InsertPlan): Promise<Plan> {
    const [plan] = await db
      .insert(plans)
      .values(insertPlan)
      .returning();
    return plan;
  }

  async updatePlan(id: string, updatePlan: UpdatePlan): Promise<Plan> {
    const [plan] = await db
      .update(plans)
      .set({ ...updatePlan, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return plan;
  }

  async getDashboardMetrics(filters: any): Promise<any> {
    const conditions = [];
    
    if (filters.managerId) {
      conditions.push(eq(deals.managerId, filters.managerId));
    }
    if (filters.project) {
      conditions.push(eq(deals.project, filters.project));
    }
    if (filters.dateFrom) {
      conditions.push(gte(deals.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(deals.createdAt, filters.dateTo));
    }

    // Оптимизированный объединенный запрос для основных метрик
    const metricsQuery = db
      .select({
        totalSales: sql<string>`COALESCE(SUM(CAST(${deals.paidAmount} AS NUMERIC)), 0)`,
        totalDeals: count(),
        avgDeal: sql<string>`COALESCE(AVG(CAST(${deals.paidAmount} AS NUMERIC)), 0)`,
        completedDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'completed' THEN 1 END)`,
      })
      .from(deals)
      .$dynamic();

    if (conditions.length > 0) {
      metricsQuery.where(and(...conditions));
    }

    const [metrics] = await metricsQuery;

    // Возвраты с учетом фильтров
    const returnsConditions = [...conditions];
    returnsConditions.push(eq(returns.status, 'completed'));

    const [returnsData] = await db
      .select({
        totalReturns: sql<string>`COALESCE(SUM(CAST(${returns.returnAmount} AS NUMERIC)), 0)`,
        returnsCount: count(),
      })
      .from(returns)
      .innerJoin(deals, eq(returns.dealId, deals.id))
      .where(and(...returnsConditions));

    const totalSales = Number(metrics.totalSales) || 0;
    const totalReturns = Number(returnsData.totalReturns) || 0;

    return {
      totalSales,
      totalDeals: metrics.totalDeals || 0,
      averageDeal: Number(metrics.avgDeal) || 0,
      completedDeals: Number(metrics.completedDeals) || 0,
      totalReturns,
      returnsCount: returnsData.returnsCount || 0,
      netRevenue: totalSales - totalReturns,
      conversionRate: metrics.totalDeals > 0 ? 
        Math.round((Number(metrics.completedDeals) / metrics.totalDeals) * 100) : 0,
      planCompletion: 0 // TODO: Calculate from plans
    };
  }

  async getSalesChartData(filters: any): Promise<any[]> {
    const days = parseInt(filters.days) || 7;
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const conditions = [
        gte(deals.createdAt, startOfDay),
        lte(deals.createdAt, endOfDay)
      ];

      if (filters.managerId) {
        conditions.push(eq(deals.managerId, filters.managerId));
      }

      const [dayResult] = await db
        .select({
          revenue: sql<string>`COALESCE(SUM(CAST(${deals.paidAmount} AS NUMERIC)), 0)`,
          deals: count(),
        })
        .from(deals)
        .where(and(...conditions));
      
      data.push({
        date: date.toISOString().split('T')[0],
        revenue: Number(dayResult.revenue) || 0,
        deals: dayResult.deals || 0,
      });
    }
    
    return data;
  }

  async getProjectComparison(): Promise<any[]> {
    const results = await db
      .select({
        project: deals.project,
        totalAmount: sql<string>`SUM(CAST(${deals.paidAmount} AS NUMERIC))`,
        count: count()
      })
      .from(deals)
      .groupBy(deals.project);

    const total = results.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);

    return results.map(item => {
      const amount = Number(item.totalAmount) || 0;
      return {
        project: item.project,
        totalAmount: amount,
        percentage: total > 0 ? Math.round(amount / total * 100) : 0,
        count: item.count
      };
    });
  }

  async getTopManagers(limit: number): Promise<any[]> {
    const results = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        project: users.project,
        totalSales: sql<string>`COALESCE(SUM(CAST(${deals.paidAmount} AS NUMERIC)), 0)`,
        dealCount: sql<number>`COUNT(${deals.id})`,
        completedDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'completed' THEN 1 END)`,
        avgDealSize: sql<string>`COALESCE(AVG(CAST(${deals.paidAmount} AS NUMERIC)), 0)`,
      })
      .from(users)
      .leftJoin(deals, eq(users.id, deals.managerId))
      .where(and(eq(users.role, 'manager'), eq(users.isActive, true)))
      .groupBy(users.id, users.fullName, users.project)
      .orderBy(desc(sql`COALESCE(SUM(CAST(${deals.paidAmount} AS NUMERIC)), 0)`))
      .limit(limit);

    return results.map(result => ({
      id: result.id,
      fullName: result.fullName,
      project: result.project,
      totalSales: Number(result.totalSales) || 0,
      dealCount: Number(result.dealCount) || 0,
      completedDeals: Number(result.completedDeals) || 0,
      avgDealSize: Number(result.avgDealSize) || 0,
      conversionRate: result.dealCount > 0 ? 
        Math.round((Number(result.completedDeals) / Number(result.dealCount)) * 100) : 0,
      planCompletion: 85 + Math.floor(Math.random() * 20) // Mock для демо
    }));
  }

  // New analytics methods
  async getAnalyticsOverview(filters: any): Promise<any> {
    const { period, project } = filters;
    
    // Calculate date range based on period
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(now.getMonth() - 1);
    }

    const baseConditions = [
      gte(deals.createdAt, startDate),
      lte(deals.createdAt, now)
    ];

    if (project && project !== 'all') {
      baseConditions.push(eq(deals.project, project));
    }

    const [overview] = await db
      .select({
        grossRevenue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)`,
        activeDeals: sql<number>`COUNT(CASE WHEN ${deals.status} IN ('new', 'in_progress', 'prepayment', 'partial') THEN 1 END)`,
        completedDeals: sql<number>`COUNT(CASE WHEN ${deals.status} = 'completed' THEN 1 END)`,
        totalDeals: sql<number>`COUNT(${deals.id})`,
      })
      .from(deals)
      .where(and(...baseConditions));

    // Get returns for deals made in this period (returns are calculated by deal creation date, not return date)
    const [returnsForPeriod] = await db
      .select({
        totalReturns: sql<number>`COALESCE(SUM(CAST(${returns.returnAmount} AS DECIMAL)), 0)`,
      })
      .from(returns)
      .innerJoin(deals, eq(returns.dealId, deals.id))
      .where(and(
        gte(deals.createdAt, startDate),
        lte(deals.createdAt, now),
        eq(returns.status, 'completed'),
        ...(project && project !== 'all' ? [eq(deals.project, project)] : [])
      ));

    // Calculate conversion rate
    const conversionRate = overview.totalDeals > 0 
      ? (overview.completedDeals / overview.totalDeals) * 100 
      : 0;

    return {
      grossRevenue: overview.grossRevenue,
      totalReturns: returnsForPeriod.totalReturns,
      netRevenue: overview.grossRevenue - returnsForPeriod.totalReturns,
      activeDeals: overview.activeDeals,
      conversionRate,
      planCompletion: 85.5, // Mock data for now
      revenueGrowth: 12.3, // Mock growth percentage
    };
  }

  async getRevenueTrend(period: string): Promise<any[]> {
    // Generate trend data based on actual database
    const data = [];
    const now = new Date();
    const periods = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    
    for (let i = periods; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get gross revenue for the day
      const [revenueResult] = await db
        .select({
          grossRevenue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)`,
        })
        .from(deals)
        .where(and(
          gte(deals.createdAt, startOfDay),
          lte(deals.createdAt, endOfDay),
          eq(deals.status, 'completed')
        ));

      // Get returns for deals made on this day (regardless of when return was processed)
      const [returnsResult] = await db
        .select({
          totalReturns: sql<number>`COALESCE(SUM(CAST(${returns.returnAmount} AS DECIMAL)), 0)`,
        })
        .from(returns)
        .innerJoin(deals, eq(returns.dealId, deals.id))
        .where(and(
          gte(deals.createdAt, startOfDay),
          lte(deals.createdAt, endOfDay),
          eq(returns.status, 'completed')
        ));
      
      const grossRevenue = revenueResult.grossRevenue || 0;
      const totalReturns = returnsResult.totalReturns || 0;
      
      data.push({
        period: date.toISOString().split('T')[0],
        grossRevenue,
        returns: totalReturns,
        netRevenue: grossRevenue - totalReturns,
      });
    }
    
    return data;
  }

  async getManagersPerformance(project?: string): Promise<any[]> {
    const conditions = [eq(users.role, 'manager'), eq(users.isActive, true)];
    
    if (project && project !== 'all') {
      conditions.push(eq(users.project, project as 'amazon' | 'shopify'));
    }

    const managers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        project: users.project,
        revenue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)`,
        dealsCount: sql<number>`COUNT(${deals.id})`,
        conversionRate: sql<number>`CASE WHEN COUNT(${deals.id}) > 0 THEN (COUNT(CASE WHEN ${deals.status} = 'completed' THEN 1 END) * 100.0 / COUNT(${deals.id})) ELSE 0 END`,
      })
      .from(users)
      .leftJoin(deals, eq(users.id, deals.managerId))
      .where(and(...conditions))
      .groupBy(users.id, users.fullName, users.project)
      .orderBy(desc(sql`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)`));

    return managers.map(manager => ({
      ...manager,
      planCompletion: Math.floor(Math.random() * 30) + 70, // Mock data
    }));
  }

  async getProjectsComparison(): Promise<any[]> {
    return this.getProjectComparison();
  }

  async getConversionFunnel(project?: string): Promise<any> {
    const conditions = [];
    
    if (project && project !== 'all') {
      conditions.push(eq(deals.project, project as 'amazon' | 'shopify'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [funnel] = await db
      .select({
        leads: sql<number>`COUNT(${deals.id})`,
        contacts: sql<number>`COUNT(CASE WHEN ${deals.status} IN ('in_progress', 'prepayment', 'partial', 'completed') THEN 1 END)`,
        negotiations: sql<number>`COUNT(CASE WHEN ${deals.status} IN ('prepayment', 'partial', 'completed') THEN 1 END)`,
        completed: sql<number>`COUNT(CASE WHEN ${deals.status} = 'completed' THEN 1 END)`,
      })
      .from(deals)
      .where(whereClause);

    return funnel;
  }

  async getReturnsAnalysis(period: string): Promise<any[]> {
    const data = [];
    const now = new Date();
    const periods = period === 'week' ? 7 : period === 'month' ? 30 : 90;
    
    for (let i = periods; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const [result] = await db
        .select({
          amount: sql<number>`COALESCE(SUM(CAST(${returns.returnAmount} AS DECIMAL)), 0)`,
          count: sql<number>`COUNT(${returns.id})`,
        })
        .from(returns)
        .where(and(
          gte(returns.returnDate, startOfDay),
          lte(returns.returnDate, endOfDay)
        ));
      
      data.push({
        period: date.toISOString().split('T')[0],
        amount: result.amount || 0,
        count: result.count || 0,
      });
    }
    
    return data;
  }

  async getMonthlyReport(filters: any): Promise<any> {
    const { year, month, project } = filters;
    
    // Calculate month boundaries
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Base conditions for the month
    const baseConditions = [
      gte(deals.createdAt, startDate),
      lte(deals.createdAt, endDate)
    ];

    if (project && project !== 'all') {
      baseConditions.push(eq(deals.project, project));
    }

    // Get gross revenue for the month
    const [revenueData] = await db
      .select({
        grossRevenue: sql<number>`COALESCE(SUM(CAST(${deals.amount} AS DECIMAL)), 0)`,
        totalDeals: sql<number>`COUNT(${deals.id})`,
      })
      .from(deals)
      .where(and(...baseConditions, eq(deals.status, 'completed')));

    // Get returns for deals made in this month (regardless of when return was processed)
    const [returnsData] = await db
      .select({
        totalReturns: sql<number>`COALESCE(SUM(CAST(${returns.returnAmount} AS DECIMAL)), 0)`,
        totalReturnCount: sql<number>`COUNT(${returns.id})`,
      })
      .from(returns)
      .innerJoin(deals, eq(returns.dealId, deals.id))
      .where(and(
        gte(deals.createdAt, startDate),
        lte(deals.createdAt, endDate),
        eq(returns.status, 'completed'),
        ...(project && project !== 'all' ? [eq(deals.project, project)] : [])
      ));

    return {
      grossRevenue: revenueData.grossRevenue || 0,
      totalReturns: returnsData.totalReturns || 0,
      netRevenue: (revenueData.grossRevenue || 0) - (returnsData.totalReturns || 0),
      totalDeals: revenueData.totalDeals || 0,
      returnCount: returnsData.totalReturnCount || 0,
      sales: [], // Simplified for now
      returns: [], // Simplified for now
      managerStats: [], // Simplified for now
    };
  }
}

export const storage = new DatabaseStorage();