import { useEffect, useMemo, useState } from "react";
import "../../styles/dashboard.css";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";
import API from "../../api/axios";

const DEFAULT_BRANDING = {
  clinic_name: "DentoGraph",
  brand_name: "DentoGraph",
  brand_logo_url: null,
  primary_color: "#2563EB",
  secondary_color: "#0F172A",
  welcome_message: null,
};

const readStoredUser = () => {
  try {
    const value = localStorage.getItem("user");
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

const getBrandingCacheKey = (user, clinicId) => {
  const userId = user?.user_id || user?.id || "unknown";
  const role = user?.role || "unknown";
  const scope =
    role === "Clinic Owner" && clinicId
      ? `clinic-${clinicId}`
      : "assigned-clinic";

  return `dentographBranding:${userId}:${role}:${scope}`;
};

const readCachedBranding = (cacheKey) => {
  try {
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const saveCachedBranding = (cacheKey, branding) => {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(branding));
  } catch {
    // Branding still works even when local storage is unavailable.
  }
};

const normalizeHex = (value, fallback) => {
  const color = String(value || "").trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color.toUpperCase();
  }

  return fallback;
};

const hexToRgb = (hex) => {
  const normalized = normalizeHex(hex, "#000000");

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
};

const getRelativeLuminance = (hex) => {
  const { r, g, b } = hexToRgb(hex);

  const channels = [r, g, b].map((channel) => {
    const value = channel / 255;

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const getContrastText = (backgroundColor) => {
  const luminance = getRelativeLuminance(backgroundColor);

  return luminance > 0.5 ? "#07111F" : "#FFFFFF";
};

const mixHexColors = (firstHex, secondHex, weight = 0.5) => {
  const first = hexToRgb(firstHex);
  const second = hexToRgb(secondHex);
  const normalizedWeight = Math.min(Math.max(Number(weight), 0), 1);

  const mixChannel = (firstChannel, secondChannel) =>
    Math.round(
      firstChannel * normalizedWeight + secondChannel * (1 - normalizedWeight),
    );

  return `#${[
    mixChannel(first.r, second.r),
    mixChannel(first.g, second.g),
    mixChannel(first.b, second.b),
  ]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
};

const buildAccessibleBrandingVariables = (branding) => {
  const primary = normalizeHex(branding?.primary_color, "#2563EB");
  const secondary = normalizeHex(branding?.secondary_color, "#0F172A");

  const primaryLuminance = getRelativeLuminance(primary);
  const secondaryLuminance = getRelativeLuminance(secondary);

  /*
   * The secondary color controls whether the portal behaves like a
   * light or dark theme. The primary color remains the main accent.
   */
  const portalMode = secondaryLuminance >= 0.56 ? "light" : "dark";

  const primaryText = getContrastText(primary);
  const secondaryText = getContrastText(secondary);

  const isLightPortal = portalMode === "light";

  const pageBackground = isLightPortal
    ? mixHexColors(secondary, "#F8FAFC", 0.18)
    : mixHexColors(secondary, "#030712", 0.82);

  const surface = isLightPortal
    ? mixHexColors(secondary, "#FFFFFF", 0.12)
    : mixHexColors(secondary, "#0F172A", 0.74);

  const surfaceElevated = isLightPortal
    ? mixHexColors(secondary, "#FFFFFF", 0.08)
    : mixHexColors(secondary, "#172033", 0.68);

  const surfaceSoft = isLightPortal
    ? mixHexColors(secondary, "#F1F5F9", 0.14)
    : mixHexColors(secondary, "#1E293B", 0.62);

  const headingText = isLightPortal ? "#0F172A" : "#F8FAFC";
  const bodyText = isLightPortal ? "#334155" : "#D8E2F0";
  const mutedText = isLightPortal ? "#64748B" : "#94A3B8";

  const borderColor = isLightPortal
    ? mixHexColors(primary, "#CBD5E1", 0.2)
    : mixHexColors(primary, "#334155", 0.32);

  const inputBackground = isLightPortal
    ? mixHexColors(secondary, "#FFFFFF", 0.08)
    : mixHexColors(secondary, "#111827", 0.68);

  const inputText = isLightPortal ? "#0F172A" : "#F8FAFC";

  const primarySoft = isLightPortal
    ? mixHexColors(primary, "#FFFFFF", 0.82)
    : mixHexColors(primary, secondary, 0.34);

  const secondarySoft = isLightPortal
    ? mixHexColors(secondary, "#FFFFFF", 0.72)
    : mixHexColors(secondary, "#111827", 0.76);

  const overlay = isLightPortal
    ? "rgba(15, 23, 42, 0.42)"
    : "rgba(2, 6, 23, 0.72)";

  const shadow = isLightPortal
    ? "0 18px 40px rgba(15, 23, 42, 0.10)"
    : "0 18px 42px rgba(0, 0, 0, 0.34)";

  return {
    "--clinic-primary": primary,
    "--clinic-secondary": secondary,
    "--clinic-primary-text": primaryText,
    "--clinic-secondary-text": secondaryText,
    "--clinic-heading-text": headingText,
    "--clinic-body-text": bodyText,
    "--clinic-muted-text": mutedText,
    "--clinic-surface": surface,
    "--clinic-surface-elevated": surfaceElevated,
    "--clinic-surface-soft": surfaceSoft,
    "--clinic-page-background": pageBackground,
    "--clinic-border": borderColor,
    "--clinic-input-background": inputBackground,
    "--clinic-input-text": inputText,
    "--clinic-primary-soft": primarySoft,
    "--clinic-secondary-soft": secondarySoft,
    "--clinic-overlay": overlay,
    "--clinic-shadow": shadow,
    "--portal-mode": portalMode,
  };
};

function DashboardLayout({ title, subtitle, children }) {
  document.documentElement.classList.remove("light-mode");
  document.documentElement.classList.add("dark-mode");
  document.body.classList.remove("light-mode");
  document.body.classList.add("dark-mode");

  const user = readStoredUser();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const selectedClinicId =
    user?.role === "Clinic Owner"
      ? localStorage.getItem("clinicOwnerSelectedClinicId")
      : null;

  const brandingCacheKey = useMemo(
    () => getBrandingCacheKey(user, selectedClinicId),
    [selectedClinicId, user?.role, user?.user_id, user?.id],
  );

  const cachedBranding = useMemo(
    () => readCachedBranding(brandingCacheKey),
    [brandingCacheKey],
  );

  const [branding, setBranding] = useState(
    cachedBranding ? { ...DEFAULT_BRANDING, ...cachedBranding } : null,
  );

  const [brandingReady, setBrandingReady] = useState(Boolean(cachedBranding));

  const brandingQuery = useMemo(() => {
    if (user?.role === "Clinic Owner" && selectedClinicId) {
      return `?clinic_id=${encodeURIComponent(selectedClinicId)}`;
    }

    return "";
  }, [selectedClinicId, user?.role]);

  useEffect(() => {
    const nextCachedBranding = readCachedBranding(brandingCacheKey);

    if (nextCachedBranding) {
      setBranding({
        ...DEFAULT_BRANDING,
        ...nextCachedBranding,
      });
      setBrandingReady(true);
    } else {
      setBranding(null);
      setBrandingReady(false);
    }
  }, [brandingCacheKey]);

  useEffect(() => {
    let active = true;

    const applyBranding = (nextBranding) => {
      const normalizedBranding = {
        ...DEFAULT_BRANDING,
        ...nextBranding,
      };

      setBranding(normalizedBranding);
      setBrandingReady(true);
      saveCachedBranding(brandingCacheKey, normalizedBranding);
    };

    const fetchBranding = async () => {
      try {
        const response = await API.get(
          `/api/clinics/branding/current${brandingQuery}`,
        );

        if (active && response.data.branding) {
          applyBranding(response.data.branding);
        }
      } catch {
        if (!active) return;

        const fallbackBranding = readCachedBranding(brandingCacheKey);

        if (fallbackBranding) {
          applyBranding(fallbackBranding);
          return;
        }

        if (user?.role === "Admin") {
          applyBranding(DEFAULT_BRANDING);
        } else {
          setBrandingReady(true);
        }
      }
    };

    fetchBranding();

    const handleBrandingUpdated = (event) => {
      if (event.detail) {
        applyBranding({
          ...(branding || {}),
          ...event.detail,
        });
      } else {
        fetchBranding();
      }
    };

    window.addEventListener(
      "dentograph-branding-updated",
      handleBrandingUpdated,
    );

    return () => {
      active = false;
      window.removeEventListener(
        "dentograph-branding-updated",
        handleBrandingUpdated,
      );
    };
  }, [brandingCacheKey, brandingQuery, user?.role]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const activeBranding = branding || DEFAULT_BRANDING;

  return (
    <div
      className={`dashboard-layout portal-theme-${
        buildAccessibleBrandingVariables(activeBranding)["--portal-mode"]
      }`}
      style={buildAccessibleBrandingVariables(activeBranding)}
    >
      <Sidebar
        role={user?.role}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        closeMobileMenu={closeMobileMenu}
      />

      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-menu-backdrop"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        />
      )}

      <main className="dashboard-main">
        <Navbar
          title={title}
          subtitle={subtitle}
          user={user}
          branding={branding}
          brandingReady={brandingReady}
        />

        <section className="dashboard-content">
          {brandingReady && branding?.welcome_message && (
            <div className="clinic-branding-welcome">
              {branding.welcome_message}
            </div>
          )}

          {children}
        </section>
      </main>
    </div>
  );
}

export default DashboardLayout;
