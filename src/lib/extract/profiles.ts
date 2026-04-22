export const DEFAULT_PROFILE = "chrome146";

const PROFILE_BY_HOST: Record<string, string> = {
  "zillow.com": "chrome146",
  "apartments.com": "firefox147",
};

export function profileForUrl(url: string): string {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  return PROFILE_BY_HOST[hostname] ?? DEFAULT_PROFILE;
}
