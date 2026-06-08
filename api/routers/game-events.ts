import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { gameEvents } from "@db/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";

// ─── Preset Live Game Events ──────────────────────────────────
// These simulate what popular games are doing right now

const PRESET_EVENTS = [
  // League of Legends
  { gameName: "League of Legends", eventName: "Season 2026 Split 2", description: "New ranked season active", multiplier: 140, startDays: -30, endDays: 60 },
  { gameName: "League of Legends", eventName: "MSI 2026 Tournament", description: "Live tournament streams", multiplier: 160, startDays: -2, endDays: 12 },
  { gameName: "League of Legends", eventName: "Double XP Weekend", description: "Earn double XP all weekend", multiplier: 130, startDays: -1, endDays: 2 },
  { gameName: "League of Legends", eventName: "New Champion Release", description: "New champion available", multiplier: 170, startDays: -1, endDays: 7 },

  // Valorant
  { gameName: "Valorant", eventName: "Episode 9 Act 1", description: "New act with battle pass", multiplier: 150, startDays: -14, endDays: 45 },
  { gameName: "Valorant", eventName: "VCT Masters", description: "Championship tournament", multiplier: 180, startDays: -1, endDays: 7 },
  { gameName: "Valorant", eventName: "Night Market", description: "Limited-time skin sale", multiplier: 125, startDays: -3, endDays: 11 },

  // Counter-Strike 2
  { gameName: "Counter-Strike 2", eventName: "Operation Refresh", description: "New operation missions", multiplier: 145, startDays: -7, endDays: 30 },
  { gameName: "Counter-Strike 2", eventName: "Major Championship", description: "CS2 Major tournament", multiplier: 200, startDays: -1, endDays: 5 },
  { gameName: "Counter-Strike 2", eventName: "New Case Drop", description: "New weapon case released", multiplier: 135, startDays: -1, endDays: 14 },

  // Fortnite
  { gameName: "Fortnite", eventName: "Chapter 6 Season 3", description: "New season with battle pass", multiplier: 155, startDays: -10, endDays: 50 },
  { gameName: "Fortnite", eventName: "Live Event", description: "In-game live event", multiplier: 220, startDays: -1, endDays: 1 },
  { gameName: "Fortnite", eventName: "FNCS Finals", description: "Championship series finals", multiplier: 140, startDays: -1, endDays: 3 },

  // Apex Legends
  { gameName: "Apex Legends", eventName: "Season 24", description: "New season with legend", multiplier: 130, startDays: -20, endDays: 55 },
  { gameName: "Apex Legends", eventName: "ALGS Championship", description: "Global series finals", multiplier: 145, startDays: -1, endDays: 4 },

  // Call of Duty
  { gameName: "Call of Duty: Warzone", eventName: "Season 5 Reloaded", description: "Mid-season update", multiplier: 135, startDays: -5, endDays: 25 },
  { gameName: "Call of Duty: Warzone", eventName: "Double Weapon XP", description: "2x weapon XP weekend", multiplier: 125, startDays: -1, endDays: 2 },

  // Dota 2
  { gameName: "Dota 2", eventName: "The International 2026", description: "Biggest tournament of the year", multiplier: 190, startDays: -3, endDays: 10 },
  { gameName: "Dota 2", eventName: "New Hero Release", description: "New hero available", multiplier: 150, startDays: -1, endDays: 10 },

  // Overwatch 2
  { gameName: "Overwatch 2", eventName: "Season 18", description: "New season with hero", multiplier: 125, startDays: -15, endDays: 60 },
  { gameName: "Overwatch 2", eventName: "Overwatch World Cup", description: "International tournament", multiplier: 155, startDays: -2, endDays: 7 },

  // PUBG
  { gameName: "PUBG", eventName: "Update 32.1", description: "New map and weapons", multiplier: 130, startDays: -7, endDays: 21 },
  { gameName: "PUBG", eventName: "Global Championship", description: "PGC tournament", multiplier: 140, startDays: -1, endDays: 5 },
];

function getRandomEvents(count: number): Array<{
  gameName: string;
  eventName: string;
  description: string;
  multiplier: number;
  startDate: Date;
  endDate: Date;
}> {
  const now = new Date();
  const shuffled = [...PRESET_EVENTS].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  return selected.map((e) => {
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() + e.startDays);
    startDate.setHours(startDate.getHours() - Math.floor(Math.random() * 12));

    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + e.endDays);
    endDate.setHours(endDate.getHours() + Math.floor(Math.random() * 12));

    return {
      gameName: e.gameName,
      eventName: e.eventName,
      description: e.description,
      multiplier: e.multiplier,
      startDate,
      endDate,
    };
  });
}

// ─── Router ───────────────────────────────────────────────────

export const gameEventsRouter = createRouter({
  // Get all currently active game events
  active: publicQuery.query(async () => {
    const db = getDb();
    const now = new Date();

    // Check if we have any active events in the DB
    let events = await db
      .select()
      .from(gameEvents)
      .where(
        and(
          eq(gameEvents.isActive, true),
          lte(gameEvents.startDate, now),
          gte(gameEvents.endDate, now)
        )
      );

    // If no events in DB, seed with random preset events
    if (events.length === 0) {
      const seedEvents = getRandomEvents(5);
      for (const e of seedEvents) {
        await db.insert(gameEvents).values({
          gameName: e.gameName,
          eventName: e.eventName,
          description: e.description,
          multiplier: e.multiplier,
          startDate: e.startDate,
          endDate: e.endDate,
          isActive: true,
        });
      }
      // Re-fetch after seeding
      events = await db
        .select()
        .from(gameEvents)
        .where(
          and(
            eq(gameEvents.isActive, true),
            lte(gameEvents.startDate, now),
            gte(gameEvents.endDate, now)
          )
        );
    }

    return events.map((e) => ({
      id: e.id,
      gameName: e.gameName,
      eventName: e.eventName,
      description: e.description,
      multiplier: e.multiplier,
      startDate: e.startDate,
      endDate: e.endDate,
    }));
  }),

  // Get all events (including upcoming and past)
  list: publicQuery.query(async () => {
    const db = getDb();
    return db.select().from(gameEvents).orderBy(gameEvents.startDate);
  }),

  // Create a new game event (admin feature)
  create: publicQuery
    .input(
      z.object({
        gameName: z.string().min(1),
        eventName: z.string().min(1),
        description: z.string().optional(),
        multiplier: z.number().min(100).max(300),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(gameEvents).values({
        gameName: input.gameName,
        eventName: input.eventName,
        description: input.description,
        multiplier: input.multiplier,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        isActive: true,
      });
      return { id: Number(result[0].insertId), success: true };
    }),

  // Deactivate an event
  deactivate: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(gameEvents)
        .set({ isActive: false })
        .where(sql`id = ${input.id}`);
      return { success: true };
    }),
});
