-- CreateEnum
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "SystemLogLevel" AS ENUM ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL');

-- CreateEnum
CREATE TYPE "SupportCaseStatus" AS ENUM ('NEW', 'CLAIMED', 'IN_PROGRESS', 'WAITING_USER', 'RESOLVED', 'CLOSED', 'SPAM');

-- CreateEnum
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "SupportMessageVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('USER', 'ADMIN', 'SYSTEM', 'GUEST');

-- AlterTable
ALTER TABLE "template_versions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "templates" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "auth_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "must_change_password" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "must_change_security_pin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "security_pin_failed_attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "security_pin_hash" TEXT,
ADD COLUMN     "security_pin_locked_until" TIMESTAMP(3),
ADD COLUMN     "security_pin_set_at" TIMESTAMP(3),
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_role" TEXT,
    "actor_email" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
    "ip_hash" TEXT,
    "device_id" TEXT,
    "request_id" TEXT,
    "summary_th" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" UUID NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "SystemLogLevel" NOT NULL DEFAULT 'INFO',
    "source" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "request_id" TEXT,
    "route" TEXT,
    "http_status" INTEGER,
    "duration_ms" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error_name" TEXT,
    "stack_digest" TEXT,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_cases" (
    "id" UUID NOT NULL,
    "case_number" SERIAL NOT NULL,
    "status" "SupportCaseStatus" NOT NULL DEFAULT 'NEW',
    "priority" "SupportCasePriority" NOT NULL DEFAULT 'NORMAL',
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "username_or_email" TEXT,
    "contact_email" TEXT NOT NULL,
    "phone" TEXT,
    "assigned_admin_id" UUID,
    "linked_user_id" UUID,
    "public_access_token_hash" TEXT NOT NULL,
    "ip_hash" TEXT,
    "device_id" TEXT,
    "user_agent_digest" TEXT,
    "claimed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_case_messages" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "visibility" "SupportMessageVisibility" NOT NULL DEFAULT 'PUBLIC',
    "senderType" "SupportSenderType" NOT NULL,
    "sender_user_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_case_status_history" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "from_status" "SupportCaseStatus",
    "to_status" "SupportCaseStatus" NOT NULL,
    "changed_by_user_id" UUID,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "support_case_id" UUID,
    "last_message_at" TIMESTAMP(3),
    "user_unread_count" INTEGER NOT NULL DEFAULT 0,
    "admin_unread_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "senderType" "SupportSenderType" NOT NULL,
    "sender_user_id" UUID,
    "visibility" "SupportMessageVisibility" NOT NULL DEFAULT 'PUBLIC',
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_action_occurred_at_idx" ON "audit_logs"("action", "occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_occurred_at_idx" ON "audit_logs"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "system_logs_occurred_at_idx" ON "system_logs"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "system_logs_level_occurred_at_idx" ON "system_logs"("level", "occurred_at");

-- CreateIndex
CREATE INDEX "system_logs_source_code_occurred_at_idx" ON "system_logs"("source", "code", "occurred_at");

-- CreateIndex
CREATE INDEX "support_cases_status_created_at_idx" ON "support_cases"("status", "created_at");

-- CreateIndex
CREATE INDEX "support_cases_assigned_admin_id_status_idx" ON "support_cases"("assigned_admin_id", "status");

-- CreateIndex
CREATE INDEX "support_cases_contact_email_idx" ON "support_cases"("contact_email");

-- CreateIndex
CREATE INDEX "support_case_messages_case_id_created_at_idx" ON "support_case_messages"("case_id", "created_at");

-- CreateIndex
CREATE INDEX "support_case_status_history_case_id_created_at_idx" ON "support_case_status_history"("case_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "support_conversations_user_id_key" ON "support_conversations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_conversations_support_case_id_key" ON "support_conversations"("support_case_id");

-- CreateIndex
CREATE INDEX "support_conversations_last_message_at_idx" ON "support_conversations"("last_message_at");

-- CreateIndex
CREATE INDEX "support_messages_conversation_id_created_at_idx" ON "support_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "app_notifications_user_id_created_at_idx" ON "app_notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_assigned_admin_id_fkey" FOREIGN KEY ("assigned_admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_cases" ADD CONSTRAINT "support_cases_linked_user_id_fkey" FOREIGN KEY ("linked_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_case_messages" ADD CONSTRAINT "support_case_messages_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_case_status_history" ADD CONSTRAINT "support_case_status_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "support_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_conversations" ADD CONSTRAINT "support_conversations_support_case_id_fkey" FOREIGN KEY ("support_case_id") REFERENCES "support_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "support_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_notifications" ADD CONSTRAINT "app_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "template_telemetry_events_template_version_id_kind_created_at_i" RENAME TO "template_telemetry_events_template_version_id_kind_created__idx";

