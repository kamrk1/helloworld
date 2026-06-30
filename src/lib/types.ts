export const ASSET_CATEGORIES = [
  "CASH",
  "EQUITY_INDIAN",
  "EQUITY_FOREIGN",
  "SAVINGS",
  "BANK_ACCOUNT",
  "PF",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const BANK_ACCOUNT_TYPES = [
  "SAVINGS",
  "CURRENT",
  "FIXED_DEPOSIT",
  "RECURRING_DEPOSIT",
  "NRE",
  "NRO",
  "OTHER",
] as const;

export type BankAccountType = (typeof BANK_ACCOUNT_TYPES)[number];

export const STOCK_EXCHANGES = ["NSE", "BSE", "NYSE", "NASDAQ", "LSE", "OTHER"] as const;

export type StockExchange = (typeof STOCK_EXCHANGES)[number];

export interface AssetRecord {
  id: string;
  name: string;
  category: string;
  currency: string;
  notes: string | null;
  value: number;
  bankName: string | null;
  accountType: string | null;
  symbol: string | null;
  quantity: number | null;
  purchasePrice: number | null;
  currentPrice: number | null;
  fees: number | null;
  exchange: string | null;
  lastRevaluedAt: Date | null;
  principal: number | null;
  interestRate: number | null;
  startDate: Date | null;
  monthlyContribution: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Asset extends AssetRecord {
  category: AssetCategory;
  accountType: BankAccountType | null;
  exchange: StockExchange | null;
}

export function asAsset(record: AssetRecord): Asset {
  return record as Asset;
}

export const CATEGORY_LABELS: Record<AssetCategory, string> = {
  CASH: "Cash",
  EQUITY_INDIAN: "Indian Equity",
  EQUITY_FOREIGN: "Foreign Equity",
  SAVINGS: "Savings",
  BANK_ACCOUNT: "Bank Accounts",
  PF: "Provident Fund (PF)",
};

export const CATEGORY_ORDER: AssetCategory[] = [
  "CASH",
  "SAVINGS",
  "BANK_ACCOUNT",
  "PF",
  "EQUITY_INDIAN",
  "EQUITY_FOREIGN",
];

export const BANK_ACCOUNT_LABELS: Record<BankAccountType, string> = {
  SAVINGS: "Savings",
  CURRENT: "Current",
  FIXED_DEPOSIT: "Fixed Deposit (FD)",
  RECURRING_DEPOSIT: "Recurring Deposit (RD)",
  NRE: "NRE Account",
  NRO: "NRO Account",
  OTHER: "Other",
};

export const EXCHANGE_LABELS: Record<StockExchange, string> = {
  NSE: "NSE (India)",
  BSE: "BSE (India)",
  NYSE: "NYSE",
  NASDAQ: "NASDAQ",
  LSE: "London (LSE)",
  OTHER: "Other",
};

export const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "SGD", "AED", "JPY"] as const;

export interface CategorySummary {
  category: AssetCategory;
  label: string;
  totalInr: number;
  count: number;
  assets: AssetRecord[];
}

export interface NetWorthSummary {
  totalInr: number;
  categories: CategorySummary[];
  lastUpdated: string;
  baseCurrency: string;
}

export interface RevaluationResult {
  id: string;
  name: string;
  symbol: string;
  previousPrice: number | null;
  currentPrice: number;
  newValue: number;
  success: boolean;
  error?: string;
}
