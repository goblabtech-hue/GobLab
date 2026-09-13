-- CreateTable
CREATE TABLE "DispositivoPush" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "folios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispositivoPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoPush_token_key" ON "DispositivoPush"("token");

-- CreateIndex
CREATE INDEX "DispositivoPush_folios_idx" ON "DispositivoPush" USING GIN ("folios");

