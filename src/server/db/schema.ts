import { pgTable, pgEnum, text, timestamp, integer, primaryKey, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
});

export const libraryStatusEnum = pgEnum("library_status", ["plan_to_watch", "watching", "watched"]);

export const library = pgTable("library", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  sourceUrl: text("source_url").notNull(),
  title: text("title").notNull(),
  poster: text("poster").notNull(),
  totalEpisodes: integer("total_episodes").notNull().default(0),
  status: libraryStatusEnum("status").notNull().default("plan_to_watch"),
  addedAt: timestamp("added_at").defaultNow(),
}, (table) => [
  uniqueIndex("library_user_source_idx").on(table.userId, table.sourceUrl),
]);

export const watchedEpisodes = pgTable(
  "watched_episodes",
  {
    userId: serial("user_id").references(() => users.id),
    sourceUrl: text("source_url").notNull(),
    episodeId: text("episode_id").notNull(),
    watchedAt: timestamp("watched_at").defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.sourceUrl, table.episodeId] }),
  ]
);
