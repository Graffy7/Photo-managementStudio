import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, Image, Animated, PanResponder, Modal, StyleSheet, Platform, useWindowDimensions,
} from "react-native";
import { photoUrl } from "../../api/photoSelectionApi";
import { BIG_COLOR, NORMAL_COLOR, colorFor } from "./PublicPhotoCard";
import type { PublicPhoto, SelectionType } from "../../types/photoSelection";

interface Props {
  photos: PublicPhoto[];
  index: number | null;
  total: number;
  hasMore: boolean;
  disabled: boolean;
  effective: (photo: PublicPhoto) => SelectionType | null;
  onIndexChange: (index: number) => void;
  onLoadMore: () => void;
  onChange: (photo: PublicPhoto, next: SelectionType | null) => void;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 4;        // 400% of the preview — plenty to check eyes, hands and focus
const STEP = 0.25;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Full-screen view of one photo. It always shows the compressed preview the studio generated on
// import — the original full-resolution file is never sent to the customer and never modified.
// Zoom and pan are a transform on that preview: wheel or pinch to zoom, drag to move around.
export function PhotoLightbox({ photos, index, total, hasMore, disabled, effective, onIndexChange, onLoadMore, onChange, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const stageHeight = Math.max(200, height - 150);

  // The live transform lives in refs (so gestures never wait on a re-render) and is mirrored into
  // Animated values; only the percentage label is React state.
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const txAnim = useRef(new Animated.Value(0)).current;
  const tyAnim = useRef(new Animated.Value(0)).current;
  const [zoomPercent, setZoomPercent] = useState(100);
  const [loaded, setLoaded] = useState(false);

  const photo = index === null ? null : photos[index] ?? null;
  const canPrev = index !== null && index > 0;
  const canNext = index !== null && (index < photos.length - 1 || hasMore);

  // How far the photo may be dragged before its edge would come inside the stage.
  const limits = useCallback((scale: number) => ({
    x: Math.max(0, (width * scale - width) / 2),
    y: Math.max(0, (stageHeight * scale - stageHeight) / 2),
  }), [width, stageHeight]);

  const apply = useCallback((scale: number, x: number, y: number) => {
    const bound = limits(scale);
    scaleRef.current = scale;
    offsetRef.current = { x: clamp(x, -bound.x, bound.x), y: clamp(y, -bound.y, bound.y) };
    scaleAnim.setValue(scale);
    txAnim.setValue(offsetRef.current.x);
    tyAnim.setValue(offsetRef.current.y);
    setZoomPercent(Math.round(scale * 100));
  }, [limits, scaleAnim, txAnim, tyAnim]);

  const reset = useCallback(() => apply(1, 0, 0), [apply]);

  // Zooming keeps whatever is under the pointer (or the centre) roughly in place.
  const zoomTo = useCallback((next: number, focusX?: number, focusY?: number) => {
    const from = scaleRef.current;
    const to = clamp(next, MIN_SCALE, MAX_SCALE);
    if (to === from) return;
    if (to === MIN_SCALE) {
      apply(MIN_SCALE, 0, 0);
      return;
    }

    const fx = focusX ?? width / 2;
    const fy = focusY ?? stageHeight / 2;
    const dx = fx - width / 2;
    const dy = fy - stageHeight / 2;
    const ratio = to / from;
    apply(to, (offsetRef.current.x - dx) * ratio + dx, (offsetRef.current.y - dy) * ratio + dy);
  }, [apply, width, stageHeight]);

  const go = (delta: number) => {
    if (index === null) return;
    const next = index + delta;
    if (next < 0) return;
    if (next >= photos.length) {
      onLoadMore();
      return;
    }
    onIndexChange(next);
  };

  // Every photo opens at 100%, unzoomed.
  useEffect(() => {
    reset();
    setLoaded(false);
  }, [photo?.photoId, reset]);

  useEffect(() => {
    if (index !== null && hasMore && index >= photos.length - 3) onLoadMore();
  }, [index, photos.length, hasMore, onLoadMore]);

  // Warm the cache for the neighbours so next/previous feels instant.
  useEffect(() => {
    if (index === null) return;
    [photos[index + 1], photos[index - 1]].forEach((p) => {
      const uri = photoUrl(p?.previewUrl);
      if (uri) Image.prefetch(uri).catch(() => undefined);
    });
  }, [index, photos]);

  // ---- gestures: drag to pan, two fingers to pinch -------------------------------------------
  const gesture = useRef({ startX: 0, startY: 0, startScale: 1, pinchDistance: 0 });
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_e, g) =>
      scaleRef.current > 1 || Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
    onPanResponderGrant: (e) => {
      gesture.current.startX = offsetRef.current.x;
      gesture.current.startY = offsetRef.current.y;
      gesture.current.startScale = scaleRef.current;
      const touches = e.nativeEvent.touches;
      gesture.current.pinchDistance = touches.length === 2 ? distance(touches) : 0;
    },
    onPanResponderMove: (e, g) => {
      const touches = e.nativeEvent.touches;
      if (touches.length === 2) {
        const current = distance(touches);
        if (gesture.current.pinchDistance === 0) {
          gesture.current.pinchDistance = current;
          gesture.current.startScale = scaleRef.current;
          return;
        }
        const next = gesture.current.startScale * (current / gesture.current.pinchDistance);
        const midX = (touches[0].pageX + touches[1].pageX) / 2;
        const midY = (touches[0].pageY + touches[1].pageY) / 2;
        zoomTo(next, midX, midY - 64);
        return;
      }

      if (scaleRef.current > 1) {
        apply(scaleRef.current, gesture.current.startX + g.dx, gesture.current.startY + g.dy);
      }
    },
    onPanResponderRelease: () => {
      gesture.current.pinchDistance = 0;
    },
  }), [apply, zoomTo]);

  // On the web the wheel zooms towards the cursor, and two fingers pinch. Both are wired to the
  // DOM directly: react-native-web's responder system reports a single pointer, so a pinch would
  // never reach PanResponder in a phone browser - which is exactly where customers use this.
  const stageRef = useRef<View | null>(null);
  useEffect(() => {
    if (Platform.OS !== "web" || photo === null) return;
    const node = stageRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const rectOf = () => node.getBoundingClientRect();

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = rectOf();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      zoomTo(scaleRef.current * factor, e.clientX - rect.left, e.clientY - rect.top);
    };

    let pinchStart = 0;
    let scaleStart = 1;
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      pinchStart = spread(e.touches);
      scaleStart = scaleRef.current;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || pinchStart === 0) return;
      e.preventDefault();                       // stop the browser zooming the whole page instead
      const rect = rectOf();
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
      zoomTo(scaleStart * (spread(e.touches) / pinchStart), midX, midY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchStart = 0;
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    node.addEventListener("touchstart", onTouchStart, { passive: false });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd);
    node.addEventListener("touchcancel", onTouchEnd);
    return () => {
      node.removeEventListener("wheel", onWheel);
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [photo?.photoId, zoomTo]);

  // Keyboard: ← → to move, Esc to close, + / − to zoom, 0 to reset (web only).
  useEffect(() => {
    if (Platform.OS !== "web" || photo === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomTo(scaleRef.current + STEP);
      else if (e.key === "-" || e.key === "_") zoomTo(scaleRef.current - STEP);
      else if (e.key === "0") reset();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.photoId, index, photos.length, hasMore, zoomTo, reset]);

  if (photo === null) return null;

  const selection = effective(photo);
  const zoomed = zoomPercent > 100;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <View style={styles.title}>
            <Text style={styles.name} numberOfLines={1}>{photo.fileName}</Text>
            <Text style={styles.counter}>{(index ?? 0) + 1} of {total}</Text>
          </View>

          <View style={styles.zoomGroup}>
            <Pressable
              style={[styles.iconButton, zoomPercent <= 100 && styles.iconDisabled]}
              onPress={() => zoomTo(scaleRef.current - STEP)}
              disabled={zoomPercent <= 100}
              accessibilityLabel="Zoom out"
            >
              <Text style={styles.iconText}>−</Text>
            </Pressable>
            <Text style={styles.zoomLabel}>{zoomPercent}%</Text>
            <Pressable
              style={[styles.iconButton, zoomPercent >= MAX_SCALE * 100 && styles.iconDisabled]}
              onPress={() => zoomTo(scaleRef.current + STEP)}
              disabled={zoomPercent >= MAX_SCALE * 100}
              accessibilityLabel="Zoom in"
            >
              <Text style={styles.iconText}>+</Text>
            </Pressable>
            <Pressable
              style={[styles.textButton, !zoomed && styles.iconDisabled]}
              onPress={reset}
              disabled={!zoomed}
              accessibilityLabel="Reset zoom"
            >
              <Text style={styles.textButtonLabel}>Reset</Text>
            </Pressable>
          </View>

          <Pressable style={styles.closeButton} onPress={onClose} accessibilityLabel="Close">
            <Text style={styles.iconText}>✕</Text>
          </Pressable>
        </View>

        <View
          ref={stageRef}
          style={[styles.stage, { height: stageHeight }]}
          {...panResponder.panHandlers}
        >
          {/* The thumbnail is already cached from the grid, so it fills the frame instantly while
              the larger preview arrives — the customer never stares at an empty stage. */}
          {!loaded && photo.thumbnailUrl && (
            <Image
              source={{ uri: photoUrl(photo.thumbnailUrl) }}
              style={[styles.image, { width, height: stageHeight }]}
              resizeMode="contain"
              blurRadius={Platform.OS === "web" ? 0 : 2}
            />
          )}

          <Animated.View
            style={{
              width,
              height: stageHeight,
              transform: [{ translateX: txAnim }, { translateY: tyAnim }, { scale: scaleAnim }],
            }}
          >
            <Image
              source={{ uri: photoUrl(photo.previewUrl) }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="contain"
              onLoad={() => setLoaded(true)}
              accessibilityLabel={photo.fileName}
            />
          </Animated.View>

          {canPrev && !zoomed && (
            <Pressable style={[styles.arrow, { left: 8 }]} onPress={() => go(-1)} accessibilityLabel="Previous photo">
              <Text style={styles.arrowText}>‹</Text>
            </Pressable>
          )}
          {canNext && !zoomed && (
            <Pressable style={[styles.arrow, { right: 8 }]} onPress={() => go(1)} accessibilityLabel="Next photo">
              <Text style={styles.arrowText}>›</Text>
            </Pressable>
          )}

          <Text style={styles.hint}>
            {zoomed ? "Drag to move around · Reset to fit" : "Scroll or pinch to zoom in"}
          </Text>
        </View>

        <View style={styles.bottomBar}>
          {selection === null ? (
            <Pressable
              style={[styles.primary, disabled && styles.disabled]}
              disabled={disabled}
              onPress={() => onChange(photo, 1)}
            >
              <Text style={styles.primaryText}>Select this photo</Text>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[styles.selectedButton, { backgroundColor: colorFor(selection) }, disabled && styles.disabled]}
                disabled={disabled}
                onPress={() => onChange(photo, null)}
              >
                <Text style={styles.selectedText}>✓ Selected · tap to remove</Text>
              </Pressable>
              <View style={styles.radioRow}>
                {([1, 2] as SelectionType[]).map((type) => {
                  const active = selection === type;
                  const color = type === 1 ? NORMAL_COLOR : BIG_COLOR;
                  return (
                    <Pressable
                      key={type}
                      style={[styles.radio, active && { borderColor: color, backgroundColor: "rgba(255,255,255,0.08)" }, disabled && styles.disabled]}
                      disabled={disabled}
                      onPress={() => onChange(photo, type)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={[styles.dot, active && { borderColor: color }]}>
                        {active && <View style={[styles.dotFill, { backgroundColor: color }]} />}
                      </View>
                      <Text style={[styles.radioText, active && { color: "#ffffff" }]}>{type === 1 ? "Normal" : "Big"}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function distance(touches: { pageX: number; pageY: number }[]): number {
  const dx = touches[0].pageX - touches[1].pageX;
  const dy = touches[0].pageY - touches[1].pageY;
  return Math.hypot(dx, dy);
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "#050a12" },
  topBar: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8, minHeight: 64 },
  title: { flexGrow: 1, flexShrink: 1, flexBasis: 120 },
  name: { color: "#e8edf3", fontSize: 14, fontWeight: "700" },
  counter: { color: "#6f83a0", fontSize: 12, marginTop: 1 },
  zoomGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  zoomLabel: { color: "#a7b7cb", fontSize: 12, minWidth: 44, textAlign: "center", fontVariant: ["tabular-nums"] },
  iconButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#132540", alignItems: "center", justifyContent: "center" },
  iconDisabled: { opacity: 0.4 },
  textButton: { height: 34, paddingHorizontal: 12, borderRadius: 8, backgroundColor: "#132540", alignItems: "center", justifyContent: "center" },
  textButtonLabel: { color: "#e8edf3", fontSize: 12, fontWeight: "700" },
  closeButton: { width: 34, height: 34, borderRadius: 8, backgroundColor: "#23405c", alignItems: "center", justifyContent: "center" },
  iconText: { color: "#e8edf3", fontSize: 16, fontWeight: "700" },
  stage: { width: "100%", overflow: "hidden", justifyContent: "center" },
  image: { position: "absolute", top: 0, left: 0 },
  arrow: {
    position: "absolute", top: "50%", marginTop: -24, width: 44, height: 48, borderRadius: 10,
    backgroundColor: "rgba(19,37,64,0.85)", alignItems: "center", justifyContent: "center",
  },
  arrowText: { color: "#e8edf3", fontSize: 30, lineHeight: 34, fontWeight: "300" },
  hint: { position: "absolute", bottom: 8, alignSelf: "center", color: "#6f83a0", fontSize: 11 },
  bottomBar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, minHeight: 86 },
  primary: { backgroundColor: NORMAL_COLOR, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 26 },
  primaryText: { color: "#0d1826", fontWeight: "800", fontSize: 14 },
  selectedButton: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 18 },
  selectedText: { color: "#0d1826", fontWeight: "800", fontSize: 13 },
  radioRow: { flexDirection: "row", gap: 8 },
  radio: {
    flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#23405c",
    borderRadius: 10, paddingVertical: 11, paddingHorizontal: 18,
  },
  radioText: { color: "#a7b7cb", fontSize: 13, fontWeight: "700" },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: "#6f83a0", alignItems: "center", justifyContent: "center" },
  dotFill: { width: 8, height: 8, borderRadius: 4 },
  disabled: { opacity: 0.45 },
});
