import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "financist"]);
export const projectEnum = pgEnum("project", ["amazon", "shopify"]);
export const dealStatusEnum = pgEnum("deal_status", [
  "new", "in_progress", "prepayment", "partial", "completed", "cancelled", "frozen"
]);
export const returnStatusEnum = pgEnum("return_status", [
  "requested", "processing", "completed", "rejected"
]);
export const planTypeEnum = pgEnum("plan_type", ["first_half", "second_half"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  role: userRoleEnum("role").notNull().default("manager"),
  project: projectEnum("project"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Deals table
export const deals = pgTable("deals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientName: text("client_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  project: projectEnum("project").notNull(),
  program: text("program").notNull(), // Amazon PRO, Amazon PRO+, Shopify Basic, Shopify Advanced
  managerId: varchar("manager_id").notNull().references(() => users.id),
  status: dealStatusEnum("status").notNull().default("new"),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  remainingAmount: decimal("remaining_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  source: text("source"), // источник привлечения
  marketingChannel: text("marketing_channel"),
  paymentMethod: text("payment_method"),
  gender: genderEnum("gender"),
  clientSegment: text("client_segment"),
  comments: text("comments"),
  bankOrderNumber: text("bank_order_number"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Returns table
export const returns = pgTable("returns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull().references(() => deals.id),
  returnDate: timestamp("return_date").notNull(),
  returnAmount: decimal("return_amount", { precision: 12, scale: 2 }).notNull(),
  returnReason: text("return_reason").notNull(),
  status: returnStatusEnum("status").notNull().default("requested"),
  processedBy: varchar("processed_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Plans table
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  project: projectEnum("project").notNull(),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  planType: planTypeEnum("plan_type").notNull(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),
  plannedAmount: decimal("planned_amount", { precision: 12, scale: 2 }).notNull(),
  plannedDeals: integer("planned_deals").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  deals: many(deals),
  plans: many(plans),
  processedReturns: many(returns),
}));

export const dealsRelations = relations(deals, ({ one, many }) => ({
  manager: one(users, {
    fields: [deals.managerId],
    references: [users.id],
  }),
  returns: many(returns),
}));

export const returnsRelations = relations(returns, ({ one }) => ({
  deal: one(deals, {
    fields: [returns.dealId],
    references: [deals.id],
  }),
  processedBy: one(users, {
    fields: [returns.processedBy],
    references: [users.id],
  }),
}));

export const plansRelations = relations(plans, ({ one }) => ({
  manager: one(users, {
    fields: [plans.managerId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDealSchema = createInsertSchema(deals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReturnSchema = createInsertSchema(returns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  returnDate: z.union([z.date(), z.string()]).transform(val => {
    return typeof val === 'string' ? new Date(val) : val;
  }),
});

export const insertPlanSchema = createInsertSchema(plans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Update schemas
export const updateUserSchema = insertUserSchema.partial();
export const updateDealSchema = insertDealSchema.partial();
export const updateReturnSchema = insertReturnSchema.partial();
export const updatePlanSchema = insertPlanSchema.partial();

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = z.infer<typeof insertDealSchema>;
export type UpdateDeal = z.infer<typeof updateDealSchema>;

export type Return = typeof returns.$inferSelect;
export type InsertReturn = z.infer<typeof insertReturnSchema>;
export type UpdateReturn = z.infer<typeof updateReturnSchema>;

export type Plan = typeof plans.$inferSelect;
export type InsertPlan = z.infer<typeof insertPlanSchema>;
export type UpdatePlan = z.infer<typeof updatePlanSchema>;

// Enhanced types with relations
export type DealWithManager = Deal & {
  manager: User;
  returns: Return[];
};

export type ReturnWithDeal = Return & {
  deal: Deal;
  processedBy?: User;
};

export type PlanWithManager = Plan & {
  manager: User;
};
