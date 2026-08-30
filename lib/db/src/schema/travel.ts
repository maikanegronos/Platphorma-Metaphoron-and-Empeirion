import { createInsertSchema } from "drizzle-zod";
import {
  date,
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const experiencesTable = pgTable("experiences", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  location: text("location").notNull(),
  durationHours: doublePrecision("duration_hours").notNull(),
  priceFrom: doublePrecision("price_from").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url").notNull(),
  highlights: text("highlights").array().notNull(),
  rating: doublePrecision("rating").notNull(),
  reviewCount: integer("review_count").notNull(),
});

export const bookingsTable = pgTable("bookings", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  experienceId: text("experience_id"),
  title: text("title").notNull(),
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  pickup: text("pickup").notNull(),
  passengers: integer("passengers").notNull(),
  total: doublePrecision("total").notNull(),
  paid: doublePrecision("paid").notNull(),
  status: text("status").notNull(),
  driverName: text("driver_name"),
  vehicle: text("vehicle"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const driverJobsTable = pgTable("driver_jobs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  scheduledDate: date("scheduled_date", { mode: "string" }).notNull(),
  time: text("time").notNull(),
  pickup: text("pickup").notNull(),
  destination: text("destination").notNull(),
  passengers: integer("passengers").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  payout: doublePrecision("payout").notNull(),
  distanceKm: doublePrecision("distance_km").notNull(),
  status: text("status").notNull(),
  isCustom: integer("is_custom").notNull().default(0),
  claimedDriverId: text("claimed_driver_id"),
  claimedVehicle: text("claimed_vehicle"),
});

export const driversTable = pgTable("drivers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  vehicle: text("vehicle").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  rating: doublePrecision("rating").notNull(),
  trips: integer("trips").notNull(),
  status: text("status").notNull(),
  documents: integer("documents").notNull(),
});

export const insertExperienceSchema = createInsertSchema(experiencesTable);
export type InsertExperience = z.infer<typeof insertExperienceSchema>;
export type Experience = typeof experiencesTable.$inferSelect;

export const insertBookingSchema = createInsertSchema(bookingsTable);
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type Booking = typeof bookingsTable.$inferSelect;

export const insertDriverJobSchema = createInsertSchema(driverJobsTable);
export type InsertDriverJob = z.infer<typeof insertDriverJobSchema>;
export type DriverJob = typeof driverJobsTable.$inferSelect;

export const insertDriverSchema = createInsertSchema(driversTable);
export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof driversTable.$inferSelect;