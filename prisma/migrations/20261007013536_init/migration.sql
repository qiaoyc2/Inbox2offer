-- CreateTable
CREATE TABLE "ResumeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RawEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerMessageId" TEXT NOT NULL,
    "threadId" TEXT,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "classification" TEXT,
    "classificationConfidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "company" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "location" TEXT,
    "applicationDate" DATETIME NOT NULL,
    "currentStatus" TEXT NOT NULL DEFAULT 'APPLIED',
    "resumeVersionId" TEXT,
    "lastEventAt" DATETIME,
    "notes" TEXT,
    "needsUserReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Application_resumeVersionId_fkey" FOREIGN KEY ("resumeVersionId") REFERENCES "ResumeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "sourceEmailId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATETIME NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "summary" TEXT,
    "rejectionReason" TEXT,
    "interviewRound" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationEvent_sourceEmailId_fkey" FOREIGN KEY ("sourceEmailId") REFERENCES "RawEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "applicationId" TEXT,
    "rawEmailId" TEXT,
    "candidateIds" JSONB,
    "message" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ReviewItem_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewItem_rawEmailId_fkey" FOREIGN KEY ("rawEmailId") REFERENCES "RawEmail" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ResumeVersion_name_key" ON "ResumeVersion"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RawEmail_providerMessageId_key" ON "RawEmail"("providerMessageId");

-- CreateIndex
CREATE INDEX "RawEmail_receivedAt_idx" ON "RawEmail"("receivedAt");

-- CreateIndex
CREATE INDEX "RawEmail_processed_idx" ON "RawEmail"("processed");

-- CreateIndex
CREATE INDEX "RawEmail_threadId_idx" ON "RawEmail"("threadId");

-- CreateIndex
CREATE INDEX "RawEmail_sender_idx" ON "RawEmail"("sender");

-- CreateIndex
CREATE INDEX "Application_currentStatus_idx" ON "Application"("currentStatus");

-- CreateIndex
CREATE INDEX "Application_company_idx" ON "Application"("company");

-- CreateIndex
CREATE INDEX "Application_applicationDate_idx" ON "Application"("applicationDate");

-- CreateIndex
CREATE INDEX "Application_lastEventAt_idx" ON "Application"("lastEventAt");

-- CreateIndex
CREATE INDEX "Application_needsUserReview_idx" ON "Application"("needsUserReview");

-- CreateIndex
CREATE INDEX "Application_resumeVersionId_idx" ON "Application"("resumeVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationEvent_sourceEmailId_key" ON "ApplicationEvent"("sourceEmailId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_eventDate_idx" ON "ApplicationEvent"("applicationId", "eventDate");

-- CreateIndex
CREATE INDEX "ApplicationEvent_eventType_idx" ON "ApplicationEvent"("eventType");

-- CreateIndex
CREATE INDEX "ReviewItem_status_idx" ON "ReviewItem"("status");

-- CreateIndex
CREATE INDEX "ReviewItem_type_idx" ON "ReviewItem"("type");

-- CreateIndex
CREATE INDEX "ReviewItem_applicationId_idx" ON "ReviewItem"("applicationId");
