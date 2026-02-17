import { pgTable, pgEnum, text, timestamp, integer, primaryKey, serial, uniqueIndex, index } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
})

export const libraryStatusEnum = pgEnum("library_status", ["plan_to_watch", "watching", "watched"])

export const friendshipStatusEnum = pgEnum("friendship_status", ["pending", "accepted"])

export const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    senderId: integer("sender_id")
      .notNull()
      .references(() => users.id),
    receiverId: integer("receiver_id")
      .notNull()
      .references(() => users.id),
    status: friendshipStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("friendships_pair_idx").on(table.senderId, table.receiverId),
    index("friendships_receiver_idx").on(table.receiverId),
  ],
)

export const sharedWatches = pgTable(
  "shared_watches",
  {
    id: serial("id").primaryKey(),
    user1Id: integer("user1_id")
      .notNull()
      .references(() => users.id),
    user2Id: integer("user2_id")
      .notNull()
      .references(() => users.id),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    poster: text("poster").notNull(),
    episodeId: text("episode_id"),
    episodeName: text("episode_name"),
    watchedAt: timestamp("watched_at").defaultNow(),
  },
  (table) => [index("shared_watches_users_idx").on(table.user1Id, table.user2Id)],
)

export const library = pgTable(
  "library",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    poster: text("poster").notNull(),
    totalEpisodes: integer("total_episodes").notNull().default(0),
    status: libraryStatusEnum("status").notNull().default("plan_to_watch"),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [uniqueIndex("library_user_source_idx").on(table.userId, table.sourceUrl)],
)

export const sharedLibrary = pgTable(
  "shared_library",
  {
    id: serial("id").primaryKey(),
    user1Id: integer("user1_id")
      .notNull()
      .references(() => users.id),
    user2Id: integer("user2_id")
      .notNull()
      .references(() => users.id),
    sourceUrl: text("source_url").notNull(),
    title: text("title").notNull(),
    poster: text("poster").notNull(),
    totalEpisodes: integer("total_episodes").notNull().default(0),
    status: libraryStatusEnum("status").notNull().default("plan_to_watch"),
    addedAt: timestamp("added_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("shared_library_pair_source_idx").on(table.user1Id, table.user2Id, table.sourceUrl),
    index("shared_library_users_idx").on(table.user1Id, table.user2Id),
  ],
)

export const watchedEpisodes = pgTable(
  "watched_episodes",
  {
    userId: serial("user_id").references(() => users.id),
    sourceUrl: text("source_url").notNull(),
    episodeId: text("episode_id").notNull(),
    watchedAt: timestamp("watched_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.sourceUrl, table.episodeId] })],
)
