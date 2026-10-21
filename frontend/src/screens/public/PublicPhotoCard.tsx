import { memo, useState } from "react";
import { View, Text, Pressable, Image, StyleSheet, ActivityIndicator, PixelRatio } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { photoUrl } from "../../api/photoSelectionApi";
import type { PublicPhoto, SelectionType } from "../../types/photoSelection";
import { colors, radius } from "../../ui/theme";

export const NORMAL_COLOR = colors.normal;
export const BIG_COLOR = colors.big;
export const colorFor = (type: SelectionType | null) => (type === 2 ? BIG_COLOR : NORMAL_COLOR);

interface Props {
  photo: PublicPhoto;
  selection: SelectionType | null;
  width: number;
  disabled: boolean;
  onOpen: (photo: PublicPhoto) => void;
  onChange: (photo: PublicPhoto, next: SelectionType | null) => void;
}

// One photo in the grid: tap the picture to see it large, tap "Select" to choose it (Normal by
// default), then flip between Normal and Big. The check in the corner removes it again.
// The thumbnails are 360px wide. A tile that needs more real pixels than that (phones and other
// sharp screens show a 170px tile with 2-3x the pixels) uses the 1600px preview the gallery already
// has instead, so the photo looks crisp; ordinary screens keep the small, fast thumbnail. Nothing new
// is generated or stored, and the original is never sent.
const THUMB_EDGE = 360;

function sourceFor(photo: PublicPhoto, width: number): string | undefined {
  const needed = width * PixelRatio.get();
  const useLarge = needed > THUMB_EDGE * 1.15 && !!photo.previewUrl;
  return photoUrl(useLarge ? photo.previewUrl : photo.thumbnailUrl ?? photo.previewUrl);
}

function PublicPhotoCardBase({ photo, selection, width, disabled, onOpen, onChange }: Props) {
  const selected = selection !== null;
  const accent = colorFor(selection);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const uri = sourceFor(photo, width);
  const retry = () => {
    setState("loading");
    setAttempt((a) => a + 1);
  };

  return (
    <View style={[styles.card, { width }, selected && { borderColor: accent, borderWidth: 3 }]}>
      <Pressable
        onPress={() => (state === "failed" ? retry() : onOpen(photo))}
        accessibilityRole="button"
        accessibilityLabel={state === "failed" ? `Couldn't load ${photo.fileName}. Tap to try again` : `View ${photo.fileName} larger`}
      >
        <View style={[styles.imageBox, { height: Math.round(width * 0.75) }]}>
          {uri && state !== "failed" && (
            <Image
              key={`${uri}#${attempt}`}
              source={{ uri }}
              style={styles.image}
              resizeMode="contain"
              accessibilityLabel={photo.fileName}
              onLoad={() => setState("ready")}
              onError={() => setState("failed")}
            />
          )}
          {state === "loading" && uri && (
            <View style={styles.overlayCenter} pointerEvents="none">
              <ActivityIndicator color={colors.textMuted} />
            </View>
          )}
          {(state === "failed" || !uri) && (
            <View style={styles.overlayCenter}>
              <Ionicons name="image-outline" size={26} color={colors.textMuted} />
              <Text style={styles.failText}>{uri ? "Couldn't load · tap to retry" : "Preview not available"}</Text>
            </View>
          )}
          {selected && <View style={[styles.selectedTint, { backgroundColor: accent }]} pointerEvents="none" />}
          <View style={styles.nameChip}>
            <Text style={styles.nameText} numberOfLines={1}>{photo.fileName}</Text>
          </View>
        </View>
      </Pressable>

      {selected && (
        <Pressable
          style={[styles.check, { backgroundColor: accent }]}
          disabled={disabled}
          onPress={() => onChange(photo, null)}
          accessibilityRole="button"
          accessibilityLabel={`Unselect ${photo.fileName}`}
        >
          <Text style={styles.checkText}>✓</Text>
        </Pressable>
      )}

      <View style={styles.controls}>
        {!selected ? (
          <Pressable
            style={[styles.selectButton, disabled && styles.disabled]}
            disabled={disabled}
            onPress={() => onChange(photo, 1)}
            accessibilityRole="button"
          >
            <Text style={styles.selectText}>Select</Text>
          </Pressable>
        ) : (
          <View style={styles.radioRow}>
            {([1, 2] as SelectionType[]).map((type) => {
              const active = selection === type;
              return (
                <Pressable
                  key={type}
                  style={[styles.radio, active && { borderColor: colorFor(type), backgroundColor: "rgba(255,255,255,0.06)" }, disabled && styles.disabled]}
                  disabled={disabled}
                  onPress={() => onChange(photo, type)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.dot, active && { borderColor: colorFor(type) }]}>
                    {active && <View style={[styles.dotFill, { backgroundColor: colorFor(type) }]} />}
                  </View>
                  <Text style={[styles.radioText, active && { color: colors.text }]}>{type === 1 ? "Normal" : "Big"}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

export const PublicPhotoCard = memo(PublicPhotoCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: "hidden",
  },
  imageBox: { backgroundColor: "#070e17", width: "100%" },
  image: { width: "100%", height: "100%" },
  overlayCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", gap: 6, padding: 8 },
  failText: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  // A light wash of the selection colour, so a picked photo stands out even at a glance.
  selectedTint: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.12 },
  nameChip: {
    position: "absolute", left: 6, bottom: 6, maxWidth: "80%",
    backgroundColor: "rgba(11,21,34,0.8)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  nameText: { color: colors.text, fontSize: 11 },
  check: {
    position: "absolute", top: 6, right: 6, width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#ffffff",
  },
  checkText: { color: colors.onPrimary, fontSize: 16, fontWeight: "800" },
  // Both states are the same height, so a card never changes size when a photo is picked.
  controls: { padding: 6 },
  selectButton: {
    height: 40, borderWidth: 1, borderColor: colors.normal, borderRadius: radius.control, alignItems: "center", justifyContent: "center",
  },
  selectText: { color: colors.normal, fontWeight: "700", fontSize: 14 },
  radioRow: { flexDirection: "row", gap: 6 },
  radio: {
    flex: 1, height: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.control,
  },
  radioText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  dot: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.textFaint,
    alignItems: "center", justifyContent: "center",
  },
  dotFill: { width: 7, height: 7, borderRadius: 4 },
  disabled: { opacity: 0.45 },
});
