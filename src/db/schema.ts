import { pgTable, text, timestamp, integer, boolean, varchar } from "drizzle-orm/pg-core";

export const customers = pgTable("customers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contractNumber: text("contract_number").default(""),
  phone: text("phone").notNull(),
  postalCode: text("postal_code").default(""),
  mod: text("mod").default(""),
  unitType: text("unit_type").default(""),
  year: text("year").default(""),
  contractStatus: text("contract_status").default(""),
  segment: text("segment").default(""),
  handling: text("handling").default(""),
  city: text("city").default(""),
  company: text("company").default(""),
  product: text("product").default(""),
  unit: text("unit").default(""),
  region: text("region").default(""),
  value: integer("value").default(0),
  source: text("source").default(""),
  status: text("status").default("Baru"),
  owner: text("owner").default(""),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const followUps = pgTable("follow_ups", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  channel: text("channel").default("WhatsApp"),
  outcome: text("outcome").default(""),
  interest: text("interest").default(""),
  reason: text("reason").default(""),
  nextAction: text("next_action").default(""),
  by: text("by").default(""),
  at: timestamp("at").defaultNow(),
});

export const templates = pgTable("templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  body: text("body").notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  role: text("role").default("sales"),
  active: boolean("active").default(true),
  phone: text("phone").default(""),
  note: text("note").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  by: text("by").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accAppState = pgTable("acc_app_state", {
  key: varchar("key", { length: 50 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
