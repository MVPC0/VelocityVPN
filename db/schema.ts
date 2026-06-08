import {
  mysqlTable,
  mysqlEnum,
  bigint,
  varchar,
  text,
  timestamp,
  int,
  boolean,
} from "drizzle-orm/mysql-core";

// ─── OAuth Users ──────────────────────────────────────────────

export const users = mysqlTable("users", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().notNull(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Email Auth Users ─────────────────────────────────────────

export const emailUsers = mysqlTable("email_users", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  verified: boolean("verified").default(false).notNull(),
  verificationCode: varchar("verification_code", { length: 10 }),
  // Trial fields
  trialStartedAt: timestamp("trial_started_at"),
  trialDays: int("trial_days").default(3).notNull(),
  isSubscribed: boolean("is_subscribed").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("last_sign_in_at").defaultNow().notNull(),
});

export type EmailUser = typeof emailUsers.$inferSelect;
export type InsertEmailUser = typeof emailUsers.$inferInsert;

// ─── VPN Server nodes ─────────────────────────────────────────

export const vpnServers = mysqlTable("vpn_servers", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  region: varchar("region", { length: 50 }).notNull(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  port: int("port").notNull().default(51820),
  protocol: mysqlEnum("protocol", ["wireguard", "openvpn_udp", "openvpn_tcp", "ikev2"]).default("wireguard").notNull(),
  publicKey: text("public_key"),
  isActive: boolean("is_active").default(true).notNull(),
  load: int("load").default(0).notNull(),
  maxClients: int("max_clients").default(1000).notNull(),
  lat: varchar("lat", { length: 20 }),
  lng: varchar("lng", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type VpnServer = typeof vpnServers.$inferSelect;
export type InsertVpnServer = typeof vpnServers.$inferInsert;

// ─── User VPN connections ─────────────────────────────────────

export const userConnections = mysqlTable("user_connections", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().notNull(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  serverId: bigint("server_id", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["connected", "disconnected", "connecting", "error"]).default("disconnected").notNull(),
  clientIp: varchar("client_ip", { length: 45 }),
  assignedIp: varchar("assigned_ip", { length: 45 }),
  protocol: varchar("protocol", { length: 20 }).default("wireguard"),
  bytesSent: bigint("bytes_sent", { mode: "number" }).default(0),
  bytesReceived: bigint("bytes_received", { mode: "number" }).default(0),
  connectedAt: timestamp("connected_at"),
  disconnectedAt: timestamp("disconnected_at"),
  duration: int("duration").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserConnection = typeof userConnections.$inferSelect;
export type InsertUserConnection = typeof userConnections.$inferInsert;

// ─── Ping results ─────────────────────────────────────────────

export const pingResults = mysqlTable("ping_results", {
  id: bigint("id", { mode: "number", unsigned: true }).autoincrement().notNull(),
  serverId: bigint("server_id", { mode: "number", unsigned: true }).notNull(),
  latency: int("latency").notNull(),
  jitter: int("jitter").default(0),
  packetLoss: int("packet_loss").default(0),
  measuredFrom: varchar("measured_from", { length: 50 }).default("api"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PingResult = typeof pingResults.$inferSelect;
