"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { importListingAction } from "./actions";

type RowStatus =
  | { kind: "pending" }
  | { kind: "processing" }
  | { kind: "done"; id: string }
  | { kind: "failed"; reason: string };

type Row = { url: string; status: RowStatus };

const SUPPORTED_HOST_RE = /^(www\.)?(zillow\.com|apartments\.com)$/i;
const TRAILING_PUNCTUATION_RE = /[.,;)\]}]+$/;

function extractUrls(text: string): string[] {
  const candidates = text.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
  const valid: string[] = [];
  for (const raw of candidates) {
    const cleaned = raw.replace(TRAILING_PUNCTUATION_RE, "");
    try {
      const u = new URL(cleaned);
      if (SUPPORTED_HOST_RE.test(u.hostname)) {
        valid.push(cleaned);
      }
    } catch {
      // ignore unparseable
    }
  }
  return [...new Set(valid)];
}

export function ImportForm() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const urls = useMemo(() => extractUrls(text), [text]);

  async function handleImport() {
    if (urls.length === 0 || running) return;
    setRunning(true);
    setRows(urls.map((u) => ({ url: u, status: { kind: "pending" } })));

    for (let i = 0; i < urls.length; i++) {
      setRows((prev) =>
        prev.map((r, j) =>
          j === i ? { ...r, status: { kind: "processing" } } : r,
        ),
      );
      try {
        const result = await importListingAction(urls[i]);
        setRows((prev) =>
          prev.map((r, j) =>
            j === i
              ? {
                  ...r,
                  status: result.ok
                    ? { kind: "done", id: result.id }
                    : { kind: "failed", reason: result.reason },
                }
              : r,
          ),
        );
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        setRows((prev) =>
          prev.map((r, j) =>
            j === i ? { ...r, status: { kind: "failed", reason } } : r,
          ),
        );
      }
    }

    setRunning(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">
          Paste URLs (one per line, or whole HTML with links)
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          disabled={running}
          placeholder="Paste your Zillow / Apartments.com favorites here. Both plain URLs and HTML are detected."
          className="border border-border bg-input-background text-foreground rounded p-2 text-sm font-mono placeholder:text-muted-foreground"
        />
        <span className="text-xs text-muted-foreground">
          {urls.length} listing URL{urls.length === 1 ? "" : "s"} detected
        </span>
      </label>

      <button
        type="button"
        onClick={handleImport}
        disabled={running || urls.length === 0}
        className="self-start bg-primary hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed text-primary-foreground rounded px-4 py-2 text-sm"
      >
        {running
          ? "Importing…"
          : `Import ${urls.length} listing${urls.length === 1 ? "" : "s"}`}
      </button>

      {rows.length > 0 ? (
        <ul className="border border-border rounded divide-y divide-border">
          {rows.map((row, i) => (
            <li
              key={i}
              className="px-3 py-2 flex items-center gap-3 text-sm min-w-0"
            >
              <StatusDot status={row.status} />
              <span className="flex-1 truncate font-mono text-xs">
                {row.url}
              </span>
              <StatusLabel status={row.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function StatusDot({ status }: { status: RowStatus }) {
  if (status.kind === "processing") return <Spinner />;
  const color =
    status.kind === "done"
      ? "bg-green-500"
      : status.kind === "failed"
        ? "bg-destructive"
        : "bg-muted-foreground/40";
  return <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${color}`} />;
}

function StatusLabel({ status }: { status: RowStatus }) {
  if (status.kind === "pending") {
    return <span className="text-muted-foreground shrink-0">Pending</span>;
  }
  if (status.kind === "processing") {
    return <span className="text-muted-foreground shrink-0">Importing…</span>;
  }
  if (status.kind === "done") {
    return (
      <Link
        href={`/listings/${status.id}`}
        className="text-primary hover:underline shrink-0"
      >
        View
      </Link>
    );
  }
  return (
    <span
      className="text-destructive shrink-0 max-w-xs truncate"
      title={status.reason}
    >
      {status.reason}
    </span>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-3 w-3 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}
