import { ChevronRight } from "lucide-react";
import type React from "react";
import gpayLogo from "../assets/google-pay.png";
import phonepeLogo from "../assets/phonepe.webp";
import paytmLogo from "../assets/paytm.png";

interface UpiAppButtonsProps {
  upiLink: string;
  className?: string;
}

const UPI_APPS: {
  id: string;
  name: string;
  shortLabel: string;
  bgClass: string;
  scheme: string;
  logoSrc?: string;
}[] = [
  {
    id: "phonepe",
    name: "PhonePe",
    shortLabel: "UPI",
    bgClass: "bg-[#5F259F]",
    scheme: "phonepe",
    logoSrc: phonepeLogo,
  },
  {
    id: "paytm",
    name: "PayTM",
    shortLabel: "UPI",
    bgClass: "bg-[#00B9F1]",
    scheme: "paytm",
    logoSrc: paytmLogo,
  },
  {
    id: "gpay",
    name: "Google Pay",
    shortLabel: "UPI",
    bgClass: "bg-[#1A73E8]",
    scheme: "gpay",
    logoSrc: gpayLogo,
  },
] as const;

export function UpiAppButtons({ upiLink, className = "" }: UpiAppButtonsProps) {
  const handleClick = (
    event: React.MouseEvent<HTMLAnchorElement>,
    url: string,
  ) => {
    event.preventDefault();
    window.location.assign(url);
  };

  return (
    <div className={`w-full flex flex-col gap-2 ${className}`}>
      {UPI_APPS.map((app) => (
        <a
          key={app.id}
          href={
            upiLink.startsWith("upi://")
              ? upiLink.replace("upi://", `${app.scheme}://`)
              : upiLink
          }
          onClick={(e) =>
            handleClick(
              e,
              upiLink.startsWith("upi://")
                ? upiLink.replace("upi://", `${app.scheme}://`)
                : upiLink,
            )
          }
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
      ))}
    </div>
  );
}
