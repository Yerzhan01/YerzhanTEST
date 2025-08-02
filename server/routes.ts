import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { insertUserSchema, insertDealSchema, insertReturnSchema, insertPlanSchema, type User } from "@shared/schema";
import { z } from "zod";

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Middleware for authentication
const authenticateToken = async (req: Request, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// Role-based authorization middleware
const authorize = (roles: string[]) => {
  return (req: Request, res: Response, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }
    next();
  };
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      res.status(500).json({ message: 'Login failed' });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    res.json({ message: 'Logged out successfully' });
  });

  app.get("/api/auth/me", authenticateToken, (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    const { password: _, ...userWithoutPassword } = req.user;
    res.json(userWithoutPassword);
  });

  // User routes (Admin only)
  app.get("/api/users", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ password, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post("/api/users", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const hashedPassword = await bcrypt.hash(userData.password, 10);
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });
      
      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid user data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.put("/api/users/:id", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }
      
      const user = await storage.updateUser(id, updateData);
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  // Deal routes
  app.get("/api/deals", authenticateToken, async (req, res) => {
    try {
      const { 
        project, 
        status, 
        dateFrom, 
        dateTo, 
        page = 1, 
        limit = 10 
      } = req.query;
      
      const filters: any = {
        limit: Number(limit),
        offset: (Number(page) - 1) * Number(limit),
      };
      
      // Managers can only see their own deals
      if (req.user && req.user.role === 'manager') {
        filters.managerId = req.user.id;
      }
      
      if (project) filters.project = project;
      if (status) filters.status = status;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      const [deals, total] = await Promise.all([
        storage.getDeals(filters),
        storage.getDealsCount(filters)
      ]);
      
      res.json({
        deals,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch deals' });
    }
  });

  app.get("/api/deals/:id", authenticateToken, async (req, res) => {
    try {
      const { id } = req.params;
      const deal = await storage.getDeal(id);
      
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      // Managers can only see their own deals
      if (req.user && req.user.role === 'manager' && deal.managerId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      res.json(deal);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch deal' });
    }
  });

  app.post("/api/deals", authenticateToken, authorize(['admin', 'manager']), async (req, res) => {
    try {
      const dealData = insertDealSchema.parse(req.body);
      
      // Managers can only create deals for themselves
      if (req.user && req.user.role === 'manager') {
        dealData.managerId = req.user.id;
      }
      
      const deal = await storage.createDeal(dealData);
      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid deal data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create deal' });
    }
  });

  app.put("/api/deals/:id", authenticateToken, authorize(['admin', 'manager']), async (req, res) => {
    try {
      const { id } = req.params;
      const deal = await storage.getDeal(id);
      
      if (!deal) {
        return res.status(404).json({ message: 'Deal not found' });
      }
      
      // Managers can only update their own deals
      if (req.user && req.user.role === 'manager' && deal.managerId !== req.user.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
      
      const updatedDeal = await storage.updateDeal(id, req.body);
      res.json(updatedDeal);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update deal' });
    }
  });

  app.delete("/api/deals/:id", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteDeal(id);
      res.json({ message: 'Deal deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete deal' });
    }
  });

  // Return routes
  app.get("/api/returns", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { dealId, status, dateFrom, dateTo } = req.query;
      
      const filters: any = {};
      if (dealId) filters.dealId = dealId;
      if (status) filters.status = status;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      const returns = await storage.getReturns(filters);
      res.json(returns);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch returns' });
    }
  });

  app.post("/api/returns", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const returnData = insertReturnSchema.parse(req.body);
      const newReturn = await storage.createReturn(returnData);
      res.status(201).json(newReturn);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid return data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create return' });
    }
  });

  app.put("/api/returns/:id", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const updatedReturn = await storage.updateReturn(id, req.body);
      res.json(updatedReturn);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update return' });
    }
  });

  // Plan routes
  app.get("/api/plans", authenticateToken, async (req, res) => {
    try {
      const { project, year, month, planType } = req.query;
      
      const filters: any = {};
      
      // Managers can only see their own plans
      if (req.user && req.user.role === 'manager') {
        filters.managerId = req.user.id;
      }
      
      if (project) filters.project = project;
      if (year) filters.year = Number(year);
      if (month) filters.month = Number(month);
      if (planType) filters.planType = planType;
      
      const plans = await storage.getPlans(filters);
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch plans' });
    }
  });

  app.post("/api/plans", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const planData = insertPlanSchema.parse(req.body);
      const plan = await storage.createPlan(planData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid plan data', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create plan' });
    }
  });

  app.put("/api/plans/:id", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const updatedPlan = await storage.updatePlan(id, req.body);
      res.json(updatedPlan);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update plan' });
    }
  });

  // Analytics routes
  app.get("/api/analytics/dashboard", authenticateToken, async (req, res) => {
    try {
      const { project, dateFrom, dateTo } = req.query;
      
      const filters: any = {};
      
      // Managers can only see their own analytics
      if (req.user && req.user.role === 'manager') {
        filters.managerId = req.user.id;
      }
      
      if (project) filters.project = project;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      const metrics = await storage.getDashboardMetrics(filters);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dashboard metrics' });
    }
  });

  app.get("/api/analytics/sales-chart", authenticateToken, async (req, res) => {
    try {
      const { project, days = 30 } = req.query;
      
      const filters: any = { days: Number(days) };
      
      // Managers can only see their own data
      if (req.user && req.user.role === 'manager') {
        filters.managerId = req.user.id;
      }
      
      if (project) filters.project = project;
      
      const chartData = await storage.getSalesChartData(filters);
      res.json(chartData);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch sales chart data' });
    }
  });

  app.get("/api/analytics/project-comparison", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const comparison = await storage.getProjectComparison();
      res.json(comparison);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch project comparison' });
    }
  });

  app.get("/api/analytics/top-managers", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { limit = 5 } = req.query;
      const topManagers = await storage.getTopManagers(Number(limit));
      res.json(topManagers);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch top managers' });
    }
  });

  // Export routes
  app.get("/api/export/deals", authenticateToken, async (req, res) => {
    try {
      const { format = 'excel', ...filters } = req.query;
      
      // Managers can only export their own deals
      if (req.user && req.user.role === 'manager') {
        filters.managerId = req.user.id;
      }
      
      const deals = await storage.getDeals(filters);
      
      if (format === 'excel') {
        // TODO: Implement Excel export
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=deals.xlsx');
        res.json({ message: 'Excel export not implemented yet', deals });
      } else if (format === 'pdf') {
        // TODO: Implement PDF export
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=deals.pdf');
        res.json({ message: 'PDF export not implemented yet', deals });
      } else {
        res.status(400).json({ message: 'Unsupported format' });
      }
    } catch (error) {
      res.status(500).json({ message: 'Export failed' });
    }
  });

  // Returns routes
  app.get("/api/returns", authenticateToken, async (req, res) => {
    try {
      const { status } = req.query;
      const returns = await storage.getReturns({
        managerId: req.user!.role === 'manager' ? req.user!.id : undefined,
        status: status as string,
      });
      res.json(returns);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch returns' });
    }
  });

  app.post("/api/returns", authenticateToken, authorize(['admin', 'manager']), async (req, res) => {
    try {
      const validatedData = insertReturnSchema.parse(req.body);
      const returnRecord = await storage.createReturn(validatedData);
      res.status(201).json(returnRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create return' });
    }
  });

  app.put("/api/returns/:id", authenticateToken, authorize(['admin', 'manager']), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const returnRecord = await storage.updateReturn(id, updateData);
      res.json(returnRecord);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update return' });
    }
  });

  // Plans routes
  app.get("/api/plans", authenticateToken, async (req, res) => {
    try {
      const { year, month, project } = req.query;
      const plans = await storage.getPlans({
        managerId: req.user!.role === 'manager' ? req.user!.id : undefined,
        year: year ? parseInt(year as string) : undefined,
        month: month ? parseInt(month as string) : undefined,
        project: project as string,
      });
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch plans' });
    }
  });

  app.post("/api/plans", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const validatedData = insertPlanSchema.parse(req.body);
      const plan = await storage.createPlan(validatedData);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      res.status(500).json({ message: 'Failed to create plan' });
    }
  });

  app.put("/api/plans/:id", authenticateToken, authorize(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const plan = await storage.updatePlan(id, updateData);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update plan' });
    }
  });

  // Analytics routes
  app.get("/api/analytics/overview", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { period, project } = req.query;
      const overview = await storage.getAnalyticsOverview({
        period: period as string,
        project: project as string,
      });
      res.json(overview);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch analytics overview' });
    }
  });

  app.get("/api/analytics/revenue-trend", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { period } = req.query;
      const trend = await storage.getRevenueTrend(period as string);
      res.json(trend);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch revenue trend' });
    }
  });

  app.get("/api/analytics/managers-performance", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { project } = req.query;
      const performance = await storage.getManagersPerformance(project as string);
      res.json(performance);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch managers performance' });
    }
  });

  app.get("/api/analytics/projects-comparison", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const comparison = await storage.getProjectsComparison();
      res.json(comparison);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch projects comparison' });
    }
  });

  app.get("/api/analytics/conversion-funnel", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { project } = req.query;
      const funnel = await storage.getConversionFunnel(project as string);
      res.json(funnel);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch conversion funnel' });
    }
  });

  app.get("/api/analytics/returns-analysis", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { period } = req.query;
      const analysis = await storage.getReturnsAnalysis(period as string);
      res.json(analysis);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch returns analysis' });
    }
  });

  app.get("/api/analytics/monthly-report", authenticateToken, authorize(['admin', 'financist']), async (req, res) => {
    try {
      const { year, month, project } = req.query;
      const report = await storage.getMonthlyReport({
        year: parseInt(year as string),
        month: parseInt(month as string),
        project: project as string,
      });
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch monthly report' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
