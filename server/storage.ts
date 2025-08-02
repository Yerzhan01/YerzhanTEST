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
    let query = db
      .select()
      .from(deals)
      .leftJoin(users, eq(deals.managerId, users.id))
      .orderBy(desc(deals.createdAt));

    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.offset(filters.offset);
    }

    const results = await query;
    return results.map(result => ({
      ...result.deals,
      manager: result.users!,
      returns: []
    }));
  }

  async getDealsCount(filters: any): Promise<number> {
    const [result] = await db.select({ count: count() }).from(deals);
    return result.count;
  }

  async createDeal(insertDeal: InsertDeal): Promise<Deal> {
    const [deal] = await db
      .insert(deals)
      .values(insertDeal)
      .returning();
    return deal;
  }

  async updateDeal(id: string, updateDeal: UpdateDeal): Promise<Deal> {
    const [deal] = await db
      .update(deals)
      .set({ ...updateDeal, updatedAt: new Date() })
      .where(eq(deals.id, id))
      .returning();
    return deal;
  }

  async deleteDeal(id: string): Promise<void> {
    await db.delete(deals).where(eq(deals.id, id));
  }

  async getReturns(filters: any): Promise<ReturnWithDeal[]> {
    const results = await db
      .select()
      .from(returns)
      .leftJoin(deals, eq(returns.dealId, deals.id))
      .leftJoin(users, eq(returns.processedBy, users.id))
      .orderBy(desc(returns.createdAt));

    return results.map(result => ({
      ...result.returns,
      deal: result.deals!,
      processedBy: result.users || undefined
    }));
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
    const results = await db
      .select()
      .from(plans)
      .leftJoin(users, eq(plans.managerId, users.id))
      .orderBy(desc(plans.year), desc(plans.month));

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
    // Calculate metrics from real data
    const totalSalesResult = await db
      .select({ 
        total: sql<number>`SUM(CAST(${deals.amount} AS NUMERIC))` 
      })
      .from(deals)
      .where(eq(deals.status, 'completed'));

    const totalDealsResult = await db
      .select({ count: count() })
      .from(deals);

    const totalReturnsResult = await db
      .select({ 
        total: sql<number>`SUM(CAST(${returns.returnAmount} AS NUMERIC))` 
      })
      .from(returns);

    return {
      totalSales: totalSalesResult[0]?.total || 0,
      totalDeals: totalDealsResult[0]?.count || 0,
      totalReturns: totalReturnsResult[0]?.total || 0,
      planCompletion: 0 // TODO: Calculate from plans
    };
  }

  async getSalesChartData(filters: any): Promise<any[]> {
    // Return empty array for now - will be populated with real data
    return [];
  }

  async getProjectComparison(): Promise<any[]> {
    const results = await db
      .select({
        project: deals.project,
        totalAmount: sql<number>`SUM(CAST(${deals.amount} AS NUMERIC))`,
        count: count()
      })
      .from(deals)
      .where(eq(deals.status, 'completed'))
      .groupBy(deals.project);

    const total = results.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

    return results.map(item => ({
      project: item.project,
      totalAmount: item.totalAmount || 0,
      percentage: total > 0 ? Math.round((item.totalAmount || 0) / total * 100) : 0,
      count: item.count
    }));
  }

  async getTopManagers(limit: number): Promise<any[]> {
    const results = await db
      .select({
        manager: users,
        totalSales: sql<number>`SUM(CAST(${deals.amount} AS NUMERIC))`,
        dealCount: count()
      })
      .from(deals)
      .leftJoin(users, eq(deals.managerId, users.id))
      .where(eq(deals.status, 'completed'))
      .groupBy(users.id, users.username, users.fullName, users.email, users.role, users.project, users.isActive, users.createdAt, users.updatedAt)
      .orderBy(desc(sql`SUM(CAST(${deals.amount} AS NUMERIC))`))
      .limit(limit);

    return results.map(result => ({
      manager: result.manager,
      totalSales: result.totalSales || 0,
      dealCount: result.dealCount,
      planCompletion: 0 // TODO: Calculate from plans
    }));
  }
}

export const storage = new DatabaseStorage();