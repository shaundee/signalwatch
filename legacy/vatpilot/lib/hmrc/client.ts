// ┌───────────────────────────────────────────────────────────┐
// │ File: lib/hmrc/client.ts                                  │
// └───────────────────────────────────────────────────────────┘
export type HmrcToken = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  // we store ms epoch internally
  expires_at?: number | null;
  scope?: string;
  token_type?: string; // "Bearer" | "bearer"
};

type FetchOpts = {
  method?: "GET" | "POST";
  path: string;
  token: string;
  body?: any;
};

const HMRC_BASE =
  process.env.HMRC_BASE_URL || "https://test-api.service.hmrc.gov.uk";

export async function hmrcFetch<T = any>({
  method = "GET",
  path,
  token,
  body,
}: FetchOpts): Promise<{ ok: boolean; status: number; json: T }> {
  const url = `${HMRC_BASE}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.hmrc.1.0+json",
    "Content-Type": "application/json",
    // Add correlation ID for traceability
    "Gov-Client-CorrelationId":
      (globalThis as any).crypto?.randomUUID?.() ??
      `${Date.now()}-${Math.random()}`,
  };

  // Optional: allow forcing HMRC sandbox scenario via env
  if (process.env.HMRC_TEST_SCENARIO) {
    headers["Gov-Test-Scenario"] = process.env.HMRC_TEST_SCENARIO!;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
  });

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok, status: res.status, json };
}


export class HmrcClient {
  private token: string;

  constructor(private vrn: string, tokens: HmrcToken) {
    this.token = tokens.access_token;
  }

  async getObligations(
    from?: string,
    to?: string,
    status?: "O" | "F" | "M" | "OPEN" | "FULFILLED"
  ) {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    if (status) qs.set("status", status.length === 1 ? status : status[0]!); // normalise OPEN->O

    const path = `/organisations/vat/${encodeURIComponent(
      this.vrn
    )}/obligations${qs.toString() ? "?" + qs.toString() : ""}`;

    const { ok, status: code, json } = await hmrcFetch({
      method: "GET",
      path,
      token: this.token,
    });

    if (!ok) {
      const msg = typeof json === "string" ? json : JSON.stringify(json);
      throw new Error(`HMRC obligations ${code}: ${msg}`);
    }
    return json;
  }

  /**
   * Submit VAT Return
   * - keeps zero values (removes only undefined/null)
   * - boxes 6–9 are whole pounds (integers)
   * - box 9 key is `totalAcquisitionsExVAT`
   */
  async submitReturn(body: any) {
    // keep zeros — only remove undefined/null
    const cleaned = Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined && v !== null)
    ) as Record<string, unknown>;

    const toInt = (v: unknown) => Math.round(Number(v ?? 0));
    const to2 = (v: unknown) => {
      const n = Number(v ?? 0);
      return Math.round(n * 100) / 100;
    };

    const payload = {
      periodKey: String(cleaned["periodKey"] ?? ""),

      vatDueSales: to2(cleaned["vatDueSales"]),
      vatDueAcquisitions: to2(cleaned["vatDueAcquisitions"]),
      totalVatDue: to2(cleaned["totalVatDue"]),
      vatReclaimedCurrPeriod: to2(cleaned["vatReclaimedCurrPeriod"]),
      netVatDue: to2(cleaned["netVatDue"]),

      // Boxes 6–9 must be whole pounds (integers)
      totalValueSalesExVAT: toInt(cleaned["totalValueSalesExVAT"]),
      totalValuePurchasesExVAT: toInt(cleaned["totalValuePurchasesExVAT"]),
      totalValueGoodsSuppliedExVAT: toInt(
        cleaned["totalValueGoodsSuppliedExVAT"]
      ),
      totalAcquisitionsExVAT: toInt(
        cleaned["totalAcquisitionsExVAT"] ??
          cleaned["totalValueAcquisitionsExVAT"]
      ),

      finalised: Boolean(cleaned["finalised"]),
    };

    const path = `/organisations/vat/${encodeURIComponent(this.vrn)}/returns`;
    const { ok, status, json } = await hmrcFetch({
      method: "POST",
      path,
      token: this.token,
      body: payload,
    });

    if (!ok) {
      const msg = typeof json === "string" ? json : JSON.stringify(json);
      throw new Error(`HMRC submit ${status}: ${msg}`);
    }
    return json;
  }
}
