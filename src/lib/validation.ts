import { z } from "zod";

const assetCategoryEnum = z.enum([
  "CASH",
  "EQUITY_INDIAN",
  "EQUITY_FOREIGN",
  "SAVINGS",
  "BANK_ACCOUNT",
  "PF",
]);

const bankAccountTypeEnum = z.enum([
  "SAVINGS",
  "CURRENT",
  "FIXED_DEPOSIT",
  "RECURRING_DEPOSIT",
  "NRE",
  "NRO",
  "OTHER",
]);

const stockExchangeEnum = z.enum(["NSE", "BSE", "NYSE", "NASDAQ", "LSE", "OTHER"]);

const assetFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: assetCategoryEnum,
  currency: z.string().min(3).max(3).default("INR"),
  notes: z.string().max(1000).optional().nullable(),
  value: z.number().min(0).optional(),

  bankName: z.string().max(200).optional().nullable(),
  accountType: bankAccountTypeEnum.optional().nullable(),

  symbol: z.string().max(20).optional().nullable(),
  quantity: z.number().min(0).optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  currentPrice: z.number().min(0).optional().nullable(),
  fees: z.number().min(0).optional().nullable(),
  exchange: stockExchangeEnum.optional().nullable(),

  principal: z.number().min(0).optional().nullable(),
  interestRate: z.number().min(0).max(100).optional().nullable(),
  startDate: z.string().optional().nullable(),
  monthlyContribution: z.number().min(0).optional().nullable(),
});

function refineAssetCategory(
  data: z.infer<typeof assetFieldsSchema>,
  ctx: z.RefinementCtx
) {
  if (data.category === "EQUITY_INDIAN" || data.category === "EQUITY_FOREIGN") {
    if (!data.symbol) {
      ctx.addIssue({ code: "custom", message: "Symbol is required for equities", path: ["symbol"] });
    }
    if (data.quantity == null || data.quantity <= 0) {
      ctx.addIssue({ code: "custom", message: "Quantity is required for equities", path: ["quantity"] });
    }
  }

  if (data.category === "PF") {
    if (data.principal == null) {
      ctx.addIssue({ code: "custom", message: "Principal is required for PF", path: ["principal"] });
    }
    if (data.interestRate == null) {
      ctx.addIssue({
        code: "custom",
        message: "Interest rate is required for PF MTM calculation",
        path: ["interestRate"],
      });
    }
  }

  if (data.category === "BANK_ACCOUNT" && !data.accountType) {
    ctx.addIssue({ code: "custom", message: "Account type is required", path: ["accountType"] });
  }
}

export const createAssetSchema = assetFieldsSchema.superRefine(refineAssetCategory);

export const updateAssetSchema = assetFieldsSchema.partial();

export const revalueSchema = z.object({
  assetIds: z.array(z.string()).optional(),
  category: z.enum(["EQUITY_INDIAN", "EQUITY_FOREIGN"]).optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
