import { z } from "zod";

// HMRC payload rules: 2dp for 1–5, integers for 6–9
export const MoneyStr = z.string().regex(/^-?\d+(\.\d{1,2})?$/);
export const Int = z.number().int();

export const BoxesSchema = z.object({
  vatDueSales: MoneyStr,
  vatDueAcquisitions: MoneyStr,
  totalVatDue: MoneyStr,
  vatReclaimedCurrPeriod: MoneyStr,
  netVatDue: MoneyStr,
  totalValueSalesExVAT: Int,
  totalValuePurchasesExVAT: Int,
  totalValueGoodsSuppliedExVAT: Int,
  totalAcquisitionsExVAT: Int,
});

export const SubmitQuerySchema = z.object({
  shopDomain: z.string().min(3),
  vrn: z.string().min(9).max(12),
  periodKey: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dryRun: z.string().optional(),
  finalised: z.string().optional(),
});
