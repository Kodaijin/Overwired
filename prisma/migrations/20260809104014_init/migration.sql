-- CreateEnum
CREATE TYPE "EpisodeLinkKind" AS ENUM ('RELATED', 'CONTINUATION', 'RECURRENCE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episodes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "painType" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "currentSeverity" INTEGER,
    "peakSeverity" INTEGER,
    "minSeverity" INTEGER,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "episodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pain_measurements" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "severity" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pain_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatments" (
    "id" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "treatmentTypeId" TEXT,
    "medicationName" TEXT,
    "dose" TEXT,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "effectiveness" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characteristics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "characteristics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "triggers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "symptoms" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "symptoms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isMedication" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treatment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episode_locations" (
    "episodeId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    CONSTRAINT "episode_locations_pkey" PRIMARY KEY ("episodeId","locationId")
);

-- CreateTable
CREATE TABLE "episode_characteristics" (
    "episodeId" TEXT NOT NULL,
    "characteristicId" TEXT NOT NULL,

    CONSTRAINT "episode_characteristics_pkey" PRIMARY KEY ("episodeId","characteristicId")
);

-- CreateTable
CREATE TABLE "episode_triggers" (
    "episodeId" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,

    CONSTRAINT "episode_triggers_pkey" PRIMARY KEY ("episodeId","triggerId")
);

-- CreateTable
CREATE TABLE "episode_symptoms" (
    "episodeId" TEXT NOT NULL,
    "symptomId" TEXT NOT NULL,

    CONSTRAINT "episode_symptoms_pkey" PRIMARY KEY ("episodeId","symptomId")
);

-- CreateTable
CREATE TABLE "episode_links" (
    "id" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "kind" "EpisodeLinkKind" NOT NULL DEFAULT 'RELATED',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "episode_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "episodes_userId_startedAt_idx" ON "episodes"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "episodes_userId_endedAt_idx" ON "episodes"("userId", "endedAt");

-- CreateIndex
CREATE INDEX "episodes_userId_endedAt_startedAt_idx" ON "episodes"("userId", "endedAt", "startedAt");

-- CreateIndex
CREATE INDEX "pain_measurements_episodeId_recordedAt_idx" ON "pain_measurements"("episodeId", "recordedAt");

-- CreateIndex
CREATE INDEX "treatments_episodeId_takenAt_idx" ON "treatments"("episodeId", "takenAt");

-- CreateIndex
CREATE INDEX "treatments_treatmentTypeId_idx" ON "treatments"("treatmentTypeId");

-- CreateIndex
CREATE INDEX "locations_userId_archived_idx" ON "locations"("userId", "archived");

-- CreateIndex
CREATE INDEX "locations_parentId_idx" ON "locations"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "locations_userId_slug_key" ON "locations"("userId", "slug");

-- CreateIndex
CREATE INDEX "characteristics_userId_archived_idx" ON "characteristics"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "characteristics_userId_slug_key" ON "characteristics"("userId", "slug");

-- CreateIndex
CREATE INDEX "triggers_userId_archived_idx" ON "triggers"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "triggers_userId_slug_key" ON "triggers"("userId", "slug");

-- CreateIndex
CREATE INDEX "symptoms_userId_archived_idx" ON "symptoms"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "symptoms_userId_slug_key" ON "symptoms"("userId", "slug");

-- CreateIndex
CREATE INDEX "treatment_types_userId_archived_idx" ON "treatment_types"("userId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_types_userId_slug_key" ON "treatment_types"("userId", "slug");

-- CreateIndex
CREATE INDEX "episode_locations_locationId_idx" ON "episode_locations"("locationId");

-- CreateIndex
CREATE INDEX "episode_characteristics_characteristicId_idx" ON "episode_characteristics"("characteristicId");

-- CreateIndex
CREATE INDEX "episode_triggers_triggerId_idx" ON "episode_triggers"("triggerId");

-- CreateIndex
CREATE INDEX "episode_symptoms_symptomId_idx" ON "episode_symptoms"("symptomId");

-- CreateIndex
CREATE INDEX "episode_links_toId_idx" ON "episode_links"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "episode_links_fromId_toId_kind_key" ON "episode_links"("fromId", "toId", "kind");

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pain_measurements" ADD CONSTRAINT "pain_measurements_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_treatmentTypeId_fkey" FOREIGN KEY ("treatmentTypeId") REFERENCES "treatment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "characteristics" ADD CONSTRAINT "characteristics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "triggers" ADD CONSTRAINT "triggers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "symptoms" ADD CONSTRAINT "symptoms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treatment_types" ADD CONSTRAINT "treatment_types_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_locations" ADD CONSTRAINT "episode_locations_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_locations" ADD CONSTRAINT "episode_locations_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_characteristics" ADD CONSTRAINT "episode_characteristics_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_characteristics" ADD CONSTRAINT "episode_characteristics_characteristicId_fkey" FOREIGN KEY ("characteristicId") REFERENCES "characteristics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_triggers" ADD CONSTRAINT "episode_triggers_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_triggers" ADD CONSTRAINT "episode_triggers_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_symptoms" ADD CONSTRAINT "episode_symptoms_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_symptoms" ADD CONSTRAINT "episode_symptoms_symptomId_fkey" FOREIGN KEY ("symptomId") REFERENCES "symptoms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_links" ADD CONSTRAINT "episode_links_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_links" ADD CONSTRAINT "episode_links_toId_fkey" FOREIGN KEY ("toId") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
