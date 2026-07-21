"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useT } from "@/lib/i18n";

/**
 * "Open on your phone" — a scannable QR of the farm's private link.
 *
 * The farm lives at an unguessable URL and there is no login, so getting that
 * URL from the desktop where a farm is created onto the phone that will use it
 * in the field is the real friction. A QR removes it: scan, and the farm opens
 * on the phone with the key already in the address.
 *
 * The QR is generated entirely on the client (no external image service), so
 * the private link never leaves the browser.
 */
export function FarmQr({ farmKey }: { farmKey: string }) {
  const t = useT();
  const [svg, setSvg] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const full = `${window.location.origin}/farm/${farmKey}`;
    setUrl(full);
    QRCode.toString(full, {
      type: "svg",
      margin: 1,
      color: { dark: "#23271f", light: "#00000000" },
      errorCorrectionLevel: "M",
    })
      .then(setSvg)
      .catch(() => setSvg(null));
  }, [farmKey]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{t("a.phone")}</h2>
      <p className="mt-1 text-sm text-ink-body">{t("a.phoneDesc")}</p>

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="rounded-xl border border-border bg-surface-raised p-3">
          {svg ? (
            <div
              className="h-40 w-40 [&>svg]:h-full [&>svg]:w-full"
              // The SVG is generated locally from the farm URL.
              dangerouslySetInnerHTML={{ __html: svg }}
              aria-label="QR code linking to your farm"
              role="img"
            />
          ) : (
            <div className="h-40 w-40 animate-pulse rounded bg-surface-muted" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-all font-mono text-xs text-muted">{url}</p>
          <button
            type="button"
            onClick={copy}
            className="mt-2 inline-flex min-h-[40px] cursor-pointer items-center rounded-xl border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-muted"
          >
            {copied ? "✓" : t("a.copy")}
          </button>
          <p className="mt-2 text-xs text-muted">{t("a.keyNote")}</p>
        </div>
      </div>
    </section>
  );
}
