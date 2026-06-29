-- AlterTable: add stripeSessionId to Order (null for mock-card orders, unique for Stripe)
ALTER TABLE "Order" ADD COLUMN "stripeSessionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_stripeSessionId_key" ON "Order"("stripeSessionId");
