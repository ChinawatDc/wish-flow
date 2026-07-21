-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateTable users
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable accounts (Auth.js OAuth)
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- AlterEvent: nullable creator, add owner + claimed_at
ALTER TABLE "events" ALTER COLUMN "creator_id" DROP NOT NULL;
ALTER TABLE "events" ADD COLUMN "owner_user_id" UUID;
ALTER TABLE "events" ADD COLUMN "claimed_at" TIMESTAMP(3);

-- Drop old cascade FK on creator, recreate as SET NULL
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_creator_id_fkey";
ALTER TABLE "events" ADD CONSTRAINT "events_creator_id_fkey"
  FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "events" ADD CONSTRAINT "events_owner_user_id_fkey"
  FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");
CREATE INDEX "events_owner_user_id_idx" ON "events"("owner_user_id");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Event must have at least one owner identity (legacy creator OR user)
ALTER TABLE "events" ADD CONSTRAINT "events_has_owner_check"
  CHECK ("creator_id" IS NOT NULL OR "owner_user_id" IS NOT NULL);
