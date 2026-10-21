import { View, Text, Image, Pressable, StyleSheet, Linking, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { photoUrl } from "../api/photoSelectionApi";
import { colors, radius, space, type } from "../ui/theme";

// The studio's details as customers see them. Every field except the name is optional; anything
// missing is simply not shown (never a placeholder pretending to be real information).
export interface StudioBrand {
  name: string;
  logoUrl?: string | null;
  description?: string | null;
  phone?: string | null;
  whatsAppUrl?: string | null;
  website?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
}

// Links leave the page in a new tab, without giving the other site a handle back to this one.
function open(url: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(url, "_blank", "noopener,noreferrer");
  } else {
    Linking.openURL(url).catch(() => undefined);
  }
}

// "https://www.example.com/" -> "www.example.com"
function displayHost(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// Compact header: logo (or the studio's initial), name, one-line description, and the ways to reach
// the studio as small buttons. Kept short so the photos below stay the focus.
export function StudioBrandHeader({ brand }: { brand: StudioBrand }) {
  const logo = brand.logoUrl ? photoUrl(brand.logoUrl) : null;
  const actions: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; url: string }[] = [];
  if (brand.phone) actions.push({ key: "call", label: brand.phone, icon: "call-outline", url: `tel:${brand.phone.replace(/[^\d+]/g, "")}` });
  if (brand.whatsAppUrl) actions.push({ key: "wa", label: "WhatsApp", icon: "logo-whatsapp", url: brand.whatsAppUrl });
  if (brand.website) actions.push({ key: "web", label: displayHost(brand.website), icon: "globe-outline", url: brand.website });
  if (brand.instagramUrl) actions.push({ key: "ig", label: "Instagram", icon: "logo-instagram", url: brand.instagramUrl });
  if (brand.facebookUrl) actions.push({ key: "fb", label: "Facebook", icon: "logo-facebook", url: brand.facebookUrl });

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        {logo ? (
          <Image source={{ uri: logo }} style={styles.logo} resizeMode="contain" accessibilityLabel={`${brand.name} logo`} />
        ) : (
          <View style={[styles.logo, styles.initial]}>
            <Text style={styles.initialText}>{brand.name.trim().charAt(0).toUpperCase() || "S"}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={2}>{brand.name}</Text>
          {brand.description ? <Text style={styles.description} numberOfLines={3}>{brand.description}</Text> : null}
        </View>
      </View>
      {actions.length > 0 && (
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => open(a.url)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              accessibilityRole="link"
              accessibilityLabel={a.key === "call" ? `Call ${brand.name}` : `${a.label} - opens in a new tab`}
            >
              <Ionicons name={a.icon} size={16} color={a.key === "wa" ? "#25D366" : colors.link} />
              <Text style={styles.actionText} numberOfLines={1}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  top: { flexDirection: "row", alignItems: "center", gap: space.md },
  logo: { width: 56, height: 56, borderRadius: radius.control, backgroundColor: colors.cardRaised },
  initial: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  initialText: { fontSize: 24, fontWeight: "800", color: colors.primary },
  name: { ...type.heading, fontSize: 18, color: colors.text },
  description: { ...type.small, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  action: {
    flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, maxWidth: "100%",
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.md, backgroundColor: colors.card,
  },
  actionPressed: { backgroundColor: colors.cardRaised },
  actionText: { ...type.small, fontWeight: "600", color: colors.text, flexShrink: 1 },
});
