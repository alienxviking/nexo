-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "selfDestructAt" TIMESTAMP(3);
