-- Fix: migration ก่อนหน้าสร้างคอลัมน์เป็น "senderType" (camelCase)
-- แต่ schema.prisma map เป็น "sender_type" — rename ให้ตรง
ALTER TABLE "support_case_messages" RENAME COLUMN "senderType" TO "sender_type";
ALTER TABLE "support_messages" RENAME COLUMN "senderType" TO "sender_type";
