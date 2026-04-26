export const DEFAULT_CANDIDATES = [
  "chrome146",
  "chrome145",
  "chrome142",
  "chrome136",
  "chrome131",
  "firefox147",
  "firefox144",
  "edge101",
  "safari260",
];

const CANDIDATES_BY_HOST: Record<string, string[]> = {
  "zillow.com": [
    "chrome145",
    "chrome142",
    "chrome136",
    "chrome131",
    "chrome146",
    "firefox147",
    "firefox144",
    "edge101",
    "safari260",
  ],
  "apartments.com": [
    "firefox147",
    "firefox144",
    "chrome146",
    "chrome145",
    "edge101",
    "safari260",
  ],
  "apartmentlist.com": [
    "chrome145",
    "chrome146",
    "chrome142",
    "firefox147",
    "edge101",
    "safari260",
  ],
};

export function profileCandidates(url: string): string[] {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  return CANDIDATES_BY_HOST[hostname] ?? DEFAULT_CANDIDATES;
}
