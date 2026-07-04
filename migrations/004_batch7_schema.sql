-- Migration 004: Add imageUrl to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS "imageUrl" VARCHAR(500);
