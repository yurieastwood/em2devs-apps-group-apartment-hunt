"use client";

import Script from "next/script";

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
            },
            elementId: string,
          ): unknown;
          InlineLayout: { SIMPLE: number };
        };
      };
    };
  }
}

// Google's widget loads asynchronously and calls window.googleTranslateElementInit
// once it's ready. The inline <Script> registers that callback before the
// external script loads, so the order is: register init → external script
// fetches → external script invokes init → widget mounts into the div below.
export function GoogleTranslate() {
  return (
    <>
      <div id="google_translate_element" />
      <Script id="google-translate-init" strategy="lazyOnload">
        {`
          window.googleTranslateElementInit = function() {
            new window.google.translate.TranslateElement(
              {
                pageLanguage: 'en',
                includedLanguages: 'pt',
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
