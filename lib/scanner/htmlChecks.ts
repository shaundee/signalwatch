// lib/scanner/htmlChecks.ts
import { request } from "undici";
import { load } from "cheerio";

export type Check = { name: string; status: "green" | "amber" | "red"; details?: { why: string; fix: string } };

function info(name: string): { why: string; fix: string } {
  switch (name) {
    case "ga4_present":
      return {
        why: "Without GA4 on all key pages you’ll lose purchases/attribution and under-report paid performance.",
        fix: "Install gtag/GA4 via GTM or gtag.js on all templates, including checkout/thank-you. Verify 'purchase' fires.",
      };
    case "meta_pixel_present":
      return {
        why: "Meta can’t optimize or attribute conversions without the Pixel.",
        fix: "Add Meta Pixel (or cAPI via sGTM) and fire PageView + Purchase. Verify in Events Manager.",
      };
    case "tiktok_pixel_present":
      return {
        why: "Missing pixel limits TikTok delivery and reporting.",
        fix: "Install TikTok Pixel (or Events API). Fire PageView + CompletePayment. Verify in TikTok Events.",
      };
    case "duplicate_ga4":
      return {
        why: "Duplicate GA4 configs inflate sessions/events and skew ROAS.",
        fix: "Ensure only one GA4 config per page. Remove extra GTM/gtag in theme/third-party apps.",
      };
    case "duplicate_meta":
      return {
        why: "Duplicate Meta init overcounts events, breaking optimization.",
        fix: "Keep a single `fbq('init', ...)`. Remove extra theme/app injections; dedupe GTM tags.",
      };
    case "consent_mode_v2":
      return {
        why: "Without Consent Mode v2 you may lose ad signals and violate policy in EU/UK.",
        fix: "Implement a CMP and call `gtag('consent','default',…)` before tags; pass consent to GA4/Meta/TikTok.",
      };
    case "clid_params_seen":
      return {
        why: "Stripped `gclid`/`fbclid` kills attribution across redirects and checkout.",
        fix: "Preserve `gclid/fbclid` on links/redirects; avoid apps that drop query params; add allowlist in Shopify.",
      };
    default:
      return { why: "", fix: "" };
  }
}

export async function runHtmlChecks(siteUrl: string): Promise<Check[]> {
  const res = await request(siteUrl, { method: "GET", headers: { "user-agent": "SignalWatch/0.1" } });
  const html = await res.body.text();
  const $ = load(html);
  const scriptBodies = $("script").map((_, el) => ($(el).html() || $(el).attr("src") || "")).get().join("\n");

  const checks: Check[] = [];

  const hasGA4 =
    /gtag\(['"]config['"]\s*,\s*['"]G-[A-Z0-9]+['"]\)/.test(scriptBodies) ||
    /googletagmanager\.com\/gtag\/js\?id=G-/.test(html);
  checks.push({ name: "ga4_present", status: hasGA4 ? "green" : "red", details: info("ga4_present") });

  const hasMeta = /connect\.facebook\.net\/.+\/fbevents\.js/.test(html) || /fbq\(['"]init['"]/.test(scriptBodies);
  checks.push({ name: "meta_pixel_present", status: hasMeta ? "green" : "red", details: info("meta_pixel_present") });

  const hasTT = /analytics\.tiktok\.com\/i18n\/pixel\/events\.js/.test(html) || /ttq\.load\(/.test(scriptBodies);
  checks.push({ name: "tiktok_pixel_present", status: hasTT ? "green" : "amber", details: info("tiktok_pixel_present") });

  const dupGA = (html.match(/G-[A-Z0-9]{6,}/g) || []).length > 1;
  const dupMeta = (scriptBodies.match(/fbq\(['"]init['"]/g) || []).length > 1;
  checks.push({ name: "duplicate_ga4", status: dupGA ? "amber" : "green", details: info("duplicate_ga4") });
  checks.push({ name: "duplicate_meta", status: dupMeta ? "amber" : "green", details: info("duplicate_meta") });

  const hasConsent =
    /gtag\(['"]consent['"]\s*,\s*['"]default['"]/.test(scriptBodies) ||
    /dataLayer\.push\(\s*{[^}]*consent/i.test(scriptBodies);
  checks.push({ name: "consent_mode_v2", status: hasConsent ? "green" : "amber", details: info("consent_mode_v2") });

  const hasGclid = /gclid=/.test(html);
  const hasFbclid = /fbclid=/.test(html);
  checks.push({ name: "clid_params_seen", status: hasGclid || hasFbclid ? "green" : "amber", details: info("clid_params_seen") });

  return checks;
}
