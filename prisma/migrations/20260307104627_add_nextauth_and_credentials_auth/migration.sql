-- DropIndex
DROP INDEX "Account_userId_idx";

-- AlterTable
ALTER TABLE "UserCredential" ALTER COLUMN "updatedAt" DROP DEFAULT;
