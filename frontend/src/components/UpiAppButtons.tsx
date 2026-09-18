import { ChevronRight } from "lucide-react";
import type React from "react";
import gpayLogo from "../assets/google-pay.png";
import phonepeLogo from "../assets/phonepe.webp";
import paytmLogo from "../assets/paytm.png";

/** Cross-platform safe: Android uses intent URLs; iOS avoids GPay deep link; Desktop uses upi:// */
function getPlatform(): "android" | "ios" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return "desktop";
}

/** Build Android intent URL for UPI so the right app opens (GPay, PhonePe, Paytm). */
function upiToIntentUrl(upiLink: string, packageName: string): string {
  if (!upiLink.startsWith("upi://")) return upiLink;
  const pathAndQuery = upiLink.replace(/^upi:\/\//, "");
  return `intent://upi/${pathAndQuery}#Intent;scheme=upi;package=${packageName};end;`;
}

interface UpiAppButtonsProps {
  upiLink: string;
  /** Per-app intents generated server-side via the Razorpay SDK. Preferred over client-side derivation. */
  intents?: {
    upiIntent?: string;
    gpayIntent?: string;
    phonepeIntent?: string;
    paytmIntent?: string;
  };
  className?: string;
}

const UPI_APPS: {
  id: string;
  name: string;
  shortLabel: string;
  bgClass: string;
  scheme: string;
  /** Key into the server-provided intents for this app. */
  intentKey: 'gpayIntent' | 'phonepeIntent' | 'paytmIntent';
  /** Android intent package (for intent:// URL). */
  androidPackage: string;
  logoSrc?: string;
  /** Hide on iOS (do not deep link GPay on iOS). */
  hideOnIos?: boolean;
}[] = [
  {
    id: "phonepe",
    name: "PhonePe",
    shortLabel: "UPI",
    bgClass: "bg-[#5F259F]",
    scheme: "phonepe",
    intentKey: "phonepeIntent",
    androidPackage: "com.phonepe.app",
    logoSrc: phonepeLogo,
  },
  {
    id: "paytm",
    name: "PayTM",
    shortLabel: "UPI",
    bgClass: "bg-[#00B9F1]",
    scheme: "paytmmp",
    intentKey: "paytmIntent",
    androidPackage: "net.one97.paytm",
    logoSrc: paytmLogo,
  },
  {
    id: "gpay",
    name: "Google Pay",
    shortLabel: "UPI",
    bgClass: "bg-[#1A73E8]",
    scheme: "tez",
    intentKey: "gpayIntent",
    androidPackage: "com.google.android.apps.nbu.paisa.user",
    logoSrc: gpayLogo,
    hideOnIos: true,
  },
];

export function UpiAppButtons({ upiLink, intents, className = "" }: UpiAppButtonsProps) {
  const platform = getPlatform();

  const handleClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    event.preventDefault();
    window.location.assign(url);
  };

  const getUrlForApp = (app: (typeof UPI_APPS)[number]): string => {
    // Prefer the server-generated Razorpay intent; fall back to deriving
    // from the generic UPI link for older API responses.
    const baseLink = intents?.[app.intentKey] ?? upiLink;
    if (platform === "android" && baseLink.startsWith("upi://")) {
      return upiToIntentUrl(baseLink, app.androidPackage);
    }
    if (baseLink.startsWith("upi://")) {
      return baseLink.replace("upi://", `${app.scheme}://`);
    }
    return baseLink;
  };

  const appsToShow =
    platform === "ios"
      ? UPI_APPS.filter((app) => !app.hideOnIos)
      : UPI_APPS;

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {appsToShow.map((app) => {
        const url = getUrlForApp(app);
        return (
          <a
            key={app.id}
            href={url}
            onClick={(e) => handleClick(e, url)}
            aria-label={`Pay via ${app.name}`}
            className="w-full"
          >
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-surface-border hover:bg-stone-50 active:bg-stone-100 active:scale-[0.99] transition-all">
              <div className="flex items-center gap-3">
                {app.logoSrc ? (
                  <img
                    src={app.logoSrc}
                    alt={app.name}
                    className="w-7 h-7 rounded-md object-contain"
                  />
                ) : (
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-xs font-semibold ${app.bgClass}`}
                  >
                    {app.shortLabel}
                  </span>
                )}
                <span className="text-sm font-medium text-stone-900">
                  UPI - {app.name}
                </span>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>
          </a>
        );
      })}
    </div>
  );
}
