"use client";

import Script from "next/script";
import { useSyncExternalStore } from "react";

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate?: {
        TranslateElement: {
          new (
            options: {
              pageLanguage: string;
              includedLanguages?: string;
              layout?: number;
              autoDisplay?: boolean;
            },
            elementId: string,
          ): unknown;
          InlineLayout: { SIMPLE: number };
        };
      };
    };
  }
}

type Lang = "en" | "pt";

const COOKIE_RE = /(?:^|;\s*)googtrans=([^;]+)/;

function readLang(): Lang {
  if (typeof document === "undefined") return "en";
  const match = document.cookie.match(COOKIE_RE);
  if (!match) return "en";
  return decodeURIComponent(match[1]).endsWith("/pt") ? "pt" : "en";
}

// No native event for cookie changes; we reload on change so a static
// subscribe is fine. useSyncExternalStore avoids the setState-in-effect rule.
function subscribe() {
  return () => {};
}
function getServerSnapshot(): Lang {
  return "en";
}

function setLang(next: Lang) {
  const value = next === "pt" ? "/en/pt" : "/en/en";
  // path=/ ensures the cookie is visible on every route. Some Google Translate
  // setups also need the cookie on the parent domain; setting it twice is safe.
  document.cookie = `googtrans=${value}; path=/`;
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (host && host.includes(".")) {
    document.cookie = `googtrans=${value}; path=/; domain=.${host}`;
  }
  window.location.reload();
}

// Keeps Google's translate script loaded (so the cookie-driven translation
// actually fires) but hides the default widget UI; renders our own EN/PT
// button group instead. CSS in globals.css hides the "Translated by Google"
// banner and inline tooltip.
export function GoogleTranslate() {
  const lang = useSyncExternalStore(subscribe, readLang, getServerSnapshot);

  return (
    <>
      <div id="google_translate_element" aria-hidden="true" className="hidden" />
      <div
        className="inline-flex items-center rounded border border-border overflow-hidden text-xs"
        role="group"
        aria-label="Language"
      >
        <button
          type="button"
          onClick={() => lang !== "en" && setLang("en")}
          aria-pressed={lang === "en"}
          className={`px-2 py-1 transition-colors ${
            lang === "en"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          EN
        </button>
        <button
          type="button"
          onClick={() => lang !== "pt" && setLang("pt")}
          aria-pressed={lang === "pt"}
          className={`px-2 py-1 border-l border-border transition-colors ${
            lang === "pt"
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          PT
        </button>
      </div>
      <Script id="google-translate-init" strategy="lazyOnload">
        {`
          window.googleTranslateElementInit = function() {
            new window.google.translate.TranslateElement(
              {
                pageLanguage: 'en',
                includedLanguages: 'pt',
                autoDisplay: false,
                layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
              },
              'google_translate_element'
            );
          };
        `}
      </Script>
      <Script
        src="https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
        strategy="lazyOnload"
      />
    </>
  );
}
