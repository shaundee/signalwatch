// ┌───────────────────────────────────────────────────────────┐
// │ File: lib/hmrc/types.ts                                   │
// └───────────────────────────────────────────────────────────┘

/**
 * Payload expected by POST /api/hmrc/submit
 */
export type SubmitReturnPayload = {
  shopDomain: string;
  vrn: string;
  periodKey: string;
  boxes: {
    vatDueSales: string;
    vatDueAcquisitions: string;
    totalVatDue: string;
    vatReclaimedCurrPeriod: string;
    netVatDue: string;
    totalValueSalesExVAT: string;         // whole pounds (integer string)
    totalValuePurchasesExVAT: string;
    totalValueGoodsSuppliedExVAT: string;
    totalValueAcquisitionsExVAT: string;
  };
};
