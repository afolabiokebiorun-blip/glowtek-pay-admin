import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SiteSettings {
  brandName: string;
  primaryColor: string;
  logoUrl: string | null;
}

interface SiteSettingsContextType {
  settings: SiteSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const defaultSettings: SiteSettings = {
  brandName: "Glowtek Pay",
  primaryColor: "#4C1D95",
  logoUrl: null,
};

const SiteSettingsContext = createContext<SiteSettingsContextType>({
  settings: defaultSettings,
  loading: true,
  refreshSettings: async () => {},
});

export const useSiteSettings = () => useContext(SiteSettingsContext);

export const SiteSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const loadSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("site_settings")
        .select("brand_name, primary_color, logo_url")
        .eq("merchant_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error loading site settings:", error);
      } else if (data) {
        setSettings({
          brandName: data.brand_name,
          primaryColor: data.primary_color,
          logoUrl: data.logo_url,
        });
      }
    } catch (err) {
      console.error("Failed to load site settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadSettings();
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SiteSettingsContext.Provider value={{ settings, loading, refreshSettings: loadSettings }}>
      {children}
    </SiteSettingsContext.Provider>
  );
};
