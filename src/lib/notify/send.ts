import { buildDailyDigest, formatDigestText } from "./digest";
import { buildScrapeHealth } from "./health";

// Per-channel body caps. Telegram allows 4096; WhatsApp ~1600.
const TELEGRAM_MAX = 4096;
const WHATSAPP_MAX = 1500;

export type ChannelResult = {
  channel: "telegram" | "whatsapp";
  status: "sent" | "skipped" | "error";
  detail?: string;
};

async function sendTelegram(text: string): Promise<ChannelResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { channel: "telegram", status: "skipped" };
  }
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.slice(0, TELEGRAM_MAX),
          disable_web_page_preview: true,
        }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      return {
        channel: "telegram",
        status: "error",
        detail: `HTTP ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { channel: "telegram", status: "sent" };
  } catch (err) {
    return {
      channel: "telegram",
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

// Twilio WhatsApp (works with the Sandbox: set TWILIO_WHATSAPP_FROM to the
// sandbox number, and recipients must have joined the sandbox first).
// TWILIO_WHATSAPP_TO is comma-separated; each recipient is messaged.
async function sendWhatsApp(text: string): Promise<ChannelResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const toRaw = process.env.TWILIO_WHATSAPP_TO;
  if (!sid || !token || !from || !toRaw) {
    return { channel: "whatsapp", status: "skipped" };
  }
  const recipients = toRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (recipients.length === 0) {
    return { channel: "whatsapp", status: "skipped" };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const body = text.slice(0, WHATSAPP_MAX);

  let sent = 0;
  const errors: string[] = [];
  for (const to of recipients) {
    const params = new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${to}`,
      Body: body,
    });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      if (res.ok) {
        sent += 1;
      } else {
        const errBody = await res.text();
        errors.push(`${to}: HTTP ${res.status} ${errBody.slice(0, 120)}`);
      }
    } catch (err) {
      errors.push(`${to}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (sent === 0) {
    return {
      channel: "whatsapp",
      status: "error",
      detail: errors.join(" | ") || "no recipients reached",
    };
  }
  return {
    channel: "whatsapp",
    status: "sent",
    detail:
      errors.length > 0
        ? `${sent}/${recipients.length} sent; errors: ${errors.join(" | ")}`
        : `${sent}/${recipients.length} sent`,
  };
}

export type DigestNotifyResult =
  | { notified: false; reason: "nothing_to_report" }
  | {
      notified: true;
      totalChanges: number;
      issues: number;
      channels: ChannelResult[];
    };

// Build the last-24h change digest plus scrape-health issues and push them to
// every configured channel. Sends when there are changes OR refresh failures
// to report. Never throws — channel failures are captured per-channel so the
// caller (cron) is unaffected.
export async function notifyDailyDigest(): Promise<DigestNotifyResult> {
  const [digest, issues] = await Promise.all([
    buildDailyDigest(),
    buildScrapeHealth(),
  ]);
  if (digest.totalChanges === 0 && issues.length === 0) {
    return { notified: false, reason: "nothing_to_report" };
  }
  const text = formatDigestText(digest, issues, process.env.APP_BASE_URL);
  const channels = await Promise.all([sendTelegram(text), sendWhatsApp(text)]);
  return {
    notified: true,
    totalChanges: digest.totalChanges,
    issues: issues.length,
    channels,
  };
}
