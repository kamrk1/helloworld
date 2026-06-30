-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "value" REAL NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "accountType" TEXT,
    "symbol" TEXT,
    "quantity" REAL,
    "purchasePrice" REAL,
    "currentPrice" REAL,
    "fees" REAL DEFAULT 0,
    "exchange" TEXT,
    "lastRevaluedAt" DATETIME,
    "principal" REAL,
    "interestRate" REAL,
    "startDate" DATETIME,
    "monthlyContribution" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
