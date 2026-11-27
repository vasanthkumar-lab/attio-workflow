-- CreateEnum
CREATE TYPE "MailProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "MailboxStatus" AS ENUM ('ACTIVE', 'REAUTH_REQUIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "MailboxConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL DEFAULT 'default',
    "email" TEXT NOT NULL,
    "provider" "MailProvider" NOT NULL DEFAULT 'GOOGLE',
    "displayName" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessExpires" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT[],
    "status" "MailboxStatus" NOT NULL DEFAULT 'ACTIVE',
    "statusDetail" TEXT,
    "dailyLimit" INTEGER NOT NULL DEFAULT 300,
    "sentToday" INTEGER NOT NULL DEFAULT 0,
    "sentTodayOn" TIMESTAMP(3),
    "connectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailboxConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MailboxConnection_status_idx" ON "MailboxConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MailboxConnection_workspaceId_email_key" ON "MailboxConnection"("workspaceId", "email");
