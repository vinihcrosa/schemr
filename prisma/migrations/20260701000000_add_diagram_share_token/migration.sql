-- AlterTable
ALTER TABLE "Diagram" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Diagram_shareToken_key" ON "Diagram"("shareToken");
