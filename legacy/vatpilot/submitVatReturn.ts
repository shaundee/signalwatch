// ┌───────────────────────────────────────────────────────────┐
// │ File: app/(dashboard)/actions/submitVatReturn.ts          │
// └───────────────────────────────────────────────────────────┘
'use server';

import { sb } from '@/lib/supabase/server';
import { computeNineBoxesForRange } from '@/lib/vat/boxes';
import { HmrcClient, type HmrcToken } from '@/lib/hmrc/client';
import { refreshAccessToken } from '@/lib/hmrc/oauth';

export type SubmitVatReturnInput = {
  shopDomain: string;
  vrn: string;
  // Either provide periodKey OR provide from/to (ISO) to help pick an OPEN obligation
  periodKey?: string;
  fromISO?: string; // inclusive
  toISO?: string;   // exclusive
};

export type SubmitVatReturnResult =
  | { ok: true; receipt: any }
  | { ok: false; error: string; alreadySubmitted?: boolean };

export async function submitVatReturn(input: SubmitVatReturnInput): Promise<SubmitVatReturnResult> {
  const { shopDomain, vrn } = input;
  if (!shopDomain || !vrn) return { ok: false, error: 'Missing shopDomain or vrn' };

  const supabase = sb();

  // ── Load HMRC tokens ───────────────────────────────────────────────────
  const { data: rows, error: tokErr } = await supabase
    .from('hmrc_tokens')
    .select('*')
    .eq('shop_domain', shopDomain)
    .eq('vrn', vrn)
    .limit(1);

  if (tokErr) return { ok: false, error: tokErr.message };
  const row = rows?.[0];
  if (!row) return { ok: false, error: 'No HMRC tokens stored for this VRN' };

  // Convert DB timestamptz → epoch ms
  const rowExpMs =
    typeof row.expires_at === 'number'
      ? (row.expires_at as number)
      : Date.parse(String(row.expires_at));

  // ── Refresh if expiring soon (<= 60s) ───────────────────────────────────
  let tokens: HmrcToken = {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expires_in: row.expires_in ?? Math.max(Math.floor((rowExpMs - Date.now()) / 1000), 0),
    expires_at: rowExpMs,
    scope: row.scope ?? '',
    token_type: row.token_type ?? 'Bearer',
  };

  if (!tokens.expires_at || tokens.expires_at - Date.now() <= 60_000) {
    try {
      const refreshed = await refreshAccessToken(tokens.refresh_token);
      const newExpMs = Date.now() + refreshed.expires_in * 1000;

      tokens = {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token || tokens.refresh_token,
        expires_in: refreshed.expires_in,
        expires_at: newExpMs,
        scope: refreshed.scope,
        token_type: refreshed.token_type,
      };

      // Persist refresh (DB keeps timestamptz)
      const newExpiresAtISO = new Date(newExpMs).toISOString();
      const { error: upErr } = await supabase
        .from('hmrc_tokens')
        .update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          expires_in: tokens.expires_in,
          expires_at: newExpiresAtISO,
          scope: tokens.scope,
          token_type: tokens.token_type,
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', shopDomain)
        .eq('vrn', vrn);
      if (upErr) return { ok: false, error: upErr.message };
    } catch (e: any) {
      return { ok: false, error: `Failed to refresh token: ${String(e?.message || e)}` };
    }
  }

  const client = new HmrcClient(vrn, tokens);

  // ── Determine periodKey (if not provided) ───────────────────────────────
  let periodKey = input.periodKey;
  let fromISO = input.fromISO;
  let toISO = input.toISO;

// Replace your whole if (!periodKey) { ... } block with THIS:
if (!periodKey) {
  const obligations = await client.getObligations(fromISO, toISO);

  const isOpen = (s: unknown) => {
    const v = String(s ?? '').trim().toUpperCase();
    return v === 'O' || v === 'OPEN'; // HMRC can send 'O' or 'OPEN'
  };

  const open = (obligations?.obligations ?? []).find((o: any) => isOpen(o.status));
  if (!open) return { ok: false, error: 'No OPEN obligation found for this VRN' };

  periodKey = open.periodKey;

  // If dates not provided, derive them from the obligation (best-effort)
  if (!fromISO && open.start) fromISO = new Date(open.start).toISOString();
  if (!toISO && open.end) {
    // HMRC 'end' is inclusive; make exclusive end by adding 1 day
    const d = new Date(open.end);
    d.setDate(d.getDate() + 1);
    toISO = d.toISOString();
  }
}

  if (!periodKey) return { ok: false, error: 'Missing periodKey' };

  // ── Idempotency pre-check ───────────────────────────────────────────────
  {
    const { data: existing, error: exErr } = await supabase
      .from('hmrc_returns')
      .select('id')
      .eq('shop_domain', shopDomain)
      .eq('vrn', vrn)
      .eq('period_key', periodKey)
      .limit(1);

    if (exErr) return { ok: false, error: exErr.message };
    if (existing?.length) return { ok: false, error: 'Already submitted', alreadySubmitted: true };
  }

  // ── Compute nine boxes for the period ───────────────────────────────────
  if (!fromISO || !toISO) {
    // Fallback: 3 months window if we still don't have dates
    const end = new Date();
    const start = new Date(end);
    start.setMonth(end.getMonth() - 3);
    fromISO = start.toISOString();
    toISO = end.toISOString();
  }

  const boxes = await computeNineBoxesForRange({ shopDomain, fromISO, toISO });

  // ── Submit to HMRC ──────────────────────────────────────────────────────
 const to2 = (n: unknown) => Number(Math.max(Math.min(Number(n ?? 0), 999999999999), -999999999999).toFixed(2));
const toGBPInt = (n: unknown) => {
  const rounded = Math.round(Number(n ?? 0));
  return Math.max(Math.min(rounded, 999999999999), -999999999999);
};

const body = {
  periodKey: periodKey!,
  vatDueSales: to2(boxes.vatDueSales),
  vatDueAcquisitions: to2(boxes.vatDueAcquisitions),
  totalVatDue: to2(boxes.totalVatDue),
  vatReclaimedCurrPeriod: to2(boxes.vatReclaimedCurrPeriod),
  netVatDue: to2(boxes.netVatDue),
  totalValueSalesExVAT: toGBPInt(boxes.totalValueSalesExVAT),
  totalValuePurchasesExVAT: toGBPInt(boxes.totalValuePurchasesExVAT),
  totalValueGoodsSuppliedExVAT: toGBPInt(boxes.totalValueGoodsSuppliedExVAT),
  totalValueAcquisitionsExVAT: toGBPInt(boxes.totalValueAcquisitionsExVAT),
  finalised: true,
};

  let receipt: Record<string, any>;
  try {
    receipt = (await client.submitReturn(body)) as Record<string, any>;
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }

  // ── Snapshot the filing (idempotent at DB level) ────────────────────────
  const { error: insErr } = await supabase.from('hmrc_returns').insert({
    shop_domain: shopDomain,
    vrn,
    period_key: periodKey,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    boxes_json: body,           // finalised payload snapshot
    hmrc_receipt_json: receipt, // HMRC response snapshot
  });

  if ((insErr as any)?.code === '23505') {
    return { ok: false, error: 'Already submitted', alreadySubmitted: true };
  }
  if (insErr) {
    return { ok: false, error: insErr.message };
  }

  return { ok: true, receipt };
}
