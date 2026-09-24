import { themeVars, type Appearance } from "@/lib/theme";
import {
  cardBorderClass,
  cardShadowClass,
  menuButtonClass,
  resolveTypeScale,
  type CardStyle,
} from "@/lib/menu-style";

// Live preview of the real customer ordering page's look — used by both the
// Settings appearance section and the onboarding branding step so they can
// never drift apart. `phoneFrame` wraps it in a simple bezel for the wizard;
// Settings uses the flat card it always has. cardStyle/buttonShape/buttonFill/
// typeScale are optional so the onboarding wizard (which doesn't touch those
// yet) keeps working with just the original theme/font/corner preview.
export function CustomerPreview({
  appearance,
  restaurantName,
  tagline,
  bgImageUrl,
  logoUrl,
  phoneFrame = false,
  cardStyle,
  buttonShape = "rounded",
  buttonFill = "solid",
  typeScale = "comfortable",
}: {
  appearance: Appearance;
  restaurantName: string;
  tagline?: string | null;
  bgImageUrl?: string | null;
  logoUrl?: string | null;
  phoneFrame?: boolean;
  cardStyle?: CardStyle;
  buttonShape?: string;
  buttonFill?: string;
  typeScale?: string;
}) {
  const style = themeVars(appearance);
  const dark = appearance.themeMode === "dark";
  const ts = resolveTypeScale(typeScale);
  const cardCls = cardStyle
    ? `${cardBorderClass(cardStyle.border)} ${cardShadowClass(cardStyle.shadow)}`
    : "border border-line";
  const btnCls = menuButtonClass(buttonShape, buttonFill);

  const content = (
    <div
      style={style}
      className="relative rounded-[var(--radius-card)] border border-line overflow-hidden bg-paper"
    >
      {bgImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgImageUrl}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background: dark ? "rgba(8,8,10,0.75)" : "rgba(255,255,255,0.72)",
            }}
          />
        </>
      )}
      <div className="relative p-5">
        <div className="text-center mb-4">
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt=""
              className="h-8 w-auto mx-auto mb-1 object-contain"
            />
          ) : null}
          <p
            className="font-display text-lg font-semibold text-ink"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {restaurantName || "Your café"}
          </p>
          {tagline ? (
            <p className="text-xs text-ink-soft mt-0.5">{tagline}</p>
          ) : (
            <p className="text-xs text-muted">Table 4</p>
          )}
        </div>
        <div className={`rounded-[var(--radius-card)] bg-surface p-3 mb-3 flex items-center justify-between ${cardCls}`}>
          <div>
            <p style={{ fontSize: ts.itemName }} className="font-medium text-ink">
              Flat White
            </p>
            <p style={{ fontSize: ts.itemDesc }} className="text-muted">
              Silky double shot
            </p>
          </div>
          <span className={`text-xs px-3 py-1.5 ${btnCls}`}>Add</span>
        </div>
        <button type="button" className={`w-full py-2.5 text-sm font-medium ${btnCls}`}>
          Review order · 2
        </button>
      </div>
    </div>
  );

  if (!phoneFrame) return content;

  return (
    <div className="mx-auto w-full max-w-[230px]">
      <div className="rounded-[2.2rem] border-[6px] border-ink bg-ink p-1.5 shadow-float">
        <div className="rounded-[1.7rem] overflow-hidden">{content}</div>
      </div>
    </div>
  );
}
