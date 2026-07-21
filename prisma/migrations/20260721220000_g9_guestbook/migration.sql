-- CreateEnum
CREATE TYPE "GuestAccessMode" AS ENUM ('PIN', 'PUBLIC');
CREATE TYPE "GuestbookEntryStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN', 'REJECTED');

-- AlterTable
ALTER TABLE "events" ADD COLUMN "guest_access_mode" "GuestAccessMode" NOT NULL DEFAULT 'PIN',
ADD COLUMN "guestbook_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "guestbook_entries" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "display_name" TEXT,
    "message" TEXT NOT NULL,
    "status" "GuestbookEntryStatus" NOT NULL DEFAULT 'PENDING',
    "photo_url" TEXT,
    "photo_mime_type" TEXT,
    "photo_size_bytes" INTEGER,
    "ip_hash" TEXT,
    "device_id" TEXT,
    "user_agent_digest" TEXT,
    "moderated_by_user_id" UUID,
    "moderated_at" TIMESTAMP(3),
    "reject_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guestbook_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guestbook_entries_event_id_status_created_at_idx" ON "guestbook_entries"("event_id", "status", "created_at");
CREATE INDEX "guestbook_entries_event_id_created_at_idx" ON "guestbook_entries"("event_id", "created_at");

ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guestbook_entries" ADD CONSTRAINT "guestbook_entries_moderated_by_user_id_fkey" FOREIGN KEY ("moderated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
