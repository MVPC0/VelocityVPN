import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
} from "drizzle-orm/mysql-core";

// Users table (from auth feature)
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
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

// VPN Server nodes - represents actual VPN server endpoints
export const vpnServers = mysqlTable("vpn_servers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  country: varchar("country", { length: 100 }).notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  region: varchar("region", { length: 50 }).notNull(), // north_america, europe, asia_pacific, etc.
  hostname: varchar("hostname", { length: 255 }).notNull(), // e.g., ny-us.velocityvpn.com
  ipAddress: varchar("ip_address", { length: 45 }).notNull(), // IPv4 or IPv6
  port: int("port").notNull().default(51820),
  protocol: mysqlEnum("protocol", ["wireguard", "openvpn_udp", "openvpn_tcp", "ikev2"]).default("wireguard").notNull(),
  publicKey: text("public_key"), // WireGuard public key
  isActive: boolean("is_active").default(true).notNull(),
  load: int("load").default(0).notNull(), // 0-100 server load percentage
  maxClients: int("max_clients").default(1000).notNull(),
  lat: varchar("lat", { length: 20 }), // latitude for map display
  lng: varchar("lng", { length: 20 }), // longitude for map display
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type VpnServer = typeof vpnServers.$inferSelect;
export type InsertVpnServer = typeof vpnServers.$inferInsert;

// User VPN connections - tracks active and historical connections
export const userConnections = mysqlTable("user_connections", {
  id: serial("id").primaryKey(),
  userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
  serverId: bigint("server_id", { mode: "number", unsigned: true }).notNull(),
  status: mysqlEnum("status", ["connected", "disconnected", "connecting", "error"]).default("disconnected").notNull(),
  clientIp: varchar("client_ip", { length: 45 }),
  assignedIp: varchar("assigned_ip", { length: 45 }), // Internal VPN IP assigned
  protocol: varchar("protocol", { length: 20 }).default("wireguard"),
  bytesSent: bigint("bytes_sent", { mode: "number" }).default(0),
  bytesReceived: bigint("bytes_received", { mode: "number" }).default(0),
  connectedAt: timestamp("connected_at"),
  disconnectedAt: timestamp("disconnected_at"),
  duration: int("duration").default(0), // seconds
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type UserConnection = typeof userConnections.$inferSelect;
export type InsertUserConnection = typeof userConnections.$inferInsert;

// Ping results - stores real ping measurements to servers
export const pingResults = mysqlTable("ping_results", {
  id: serial("id").primaryKey(),
  serverId: bigint("server_id", { mode: "number", unsigned: true }).notNull(),
  latency: int("latency").notNull(), // ms
  jitter: int("jitter").default(0),
  packetLoss: int("packet_loss").default(0), // percentage * 100 (0-10000)
  measuredFrom: varchar("measured_from", { length: 50 }).default("api"), // where the ping was measured from
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PingResult = typeof pingResults.$inferSelect;
