import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Platform, StyleSheet, View, type GestureResponderEvent } from "react-native";
import { useCameraModeStore } from "./cameraModeStore";
import { cameraCursorCss, SHUTTER_FRAMES, type CameraCursorId, type ShutterFrame } from "./cameraCursors";
import { startFocusBlur } from "./focusBlur";
import { fireShutter, setShutterListener, SHUTTER_MS, SHUTTER_SIZE } from "./shutter";

const RING = "rgba(255,255,255,0.95)";
const IRIS = "rgba(11,21,34,0.85)";
const HALF = SHUTTER_SIZE / 2;

// Wrap the app in this once. While Camera Mode is on, every click or tap gets a small shutter
// animation at the pointer and a click sound; the tap itself is never intercepted, so whatever was
// tapped behaves exactly as it does with Camera Mode off.
export function ShutterProvider({ children }: { children: ReactNode }) {
  const enabled = useCameraModeStore((s) => s.enabled);
  const cursor = useCameraModeStore((s) => s.cursor);
  const hydrate = useCameraModeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (Platform.OS === "web") return <WebShutter enabled={enabled} cursor={cursor}>{children}</WebShutter>;
  return <NativeShutter enabled={enabled}>{children}</NativeShutter>;
}

// ---- Web: listen on the document and draw straight into the page, so it also works on top of
// modals (which React Native Web renders outside the app's root element). ------------------------
function WebShutter({ enabled, cursor, children }: { enabled: boolean; cursor: CameraCursorId; children: ReactNode }) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    // The mouse pointer becomes the chosen camera everywhere (buttons and links included) while the
    // mode is on. A browser can't animate a pointer, so the shutter is played by swapping the pointer
    // image through a few frames in which the camera's own lens closes, blinks and opens again.
    const cursorStyle = document.createElement("style");
    const show = (frame?: ShutterFrame) => {
      const css = cameraCursorCss(cursor, frame);
      cursorStyle.textContent = css ? `* { cursor: ${css} !important; }` : "";
    };
    show();
    document.head.appendChild(cursorStyle);

    let timers: ReturnType<typeof setTimeout>[] = [];
    const playInLens = () => {
      timers.forEach(clearTimeout);
      const step = SHUTTER_MS / SHUTTER_FRAMES.length;
      show(SHUTTER_FRAMES[0]);
      timers = SHUTTER_FRAMES.map((_, i) => setTimeout(() => show(SHUTTER_FRAMES[i + 1]), step * (i + 1)));
    };

    // With a camera pointer under the mouse the effect happens inside its lens. A finger has no
    // pointer, and neither does the "Normal" choice, so those get the ring drawn at the tap instead.
    let byMouse = true;
    setShutterListener((x, y) => (byMouse && cursor !== "normal" ? playInLens() : drawOnPage(x, y)));

    // "click" covers the mouse and a finished touch tap alike, and is not raised by scrolling.
    // detail === 0 is a click made from the keyboard, which has no position.
    const onClick = (e: MouseEvent) => {
      if (e.detail === 0) return;
      const pointerType = (e as PointerEvent).pointerType;
      byMouse = !pointerType || pointerType === "mouse";
      fireShutter(e.clientX, e.clientY);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      setShutterListener(null);
      timers.forEach(clearTimeout);
      cursorStyle.remove();
    };
  }, [enabled, cursor]);

  // Resting the mouse blurs everything but the area around it (see focusBlur.ts).
  useEffect(() => (enabled ? startFocusBlur() : undefined), [enabled]);

  return <>{children}</>;
}

function drawOnPage(x: number, y: number): void {
  const box = document.createElement("div");
  box.setAttribute("aria-hidden", "true");
  box.style.cssText =
    `position:fixed;left:${x - HALF}px;top:${y - HALF}px;width:${SHUTTER_SIZE}px;height:${SHUTTER_SIZE}px;` +
    "pointer-events:none;z-index:2147483647;";

  const ring = document.createElement("div");
  ring.style.cssText =
    `position:absolute;inset:0;border-radius:50%;border:2px solid ${RING};box-shadow:0 0 0 1px rgba(0,0,0,0.35);`;
  const iris = document.createElement("div");
  iris.style.cssText = `position:absolute;inset:5px;border-radius:50%;background:${IRIS};`;
  box.append(ring, iris);
  document.body.appendChild(box);

  const timing = { duration: SHUTTER_MS, easing: "ease-out" };
  iris.animate([{ transform: "scale(0.2)" }, { transform: "scale(1)", offset: 0.45 }, { transform: "scale(0.2)" }], timing);
  const done = box.animate(
    [
      { opacity: 0, transform: "scale(1.15)" },
      { opacity: 1, transform: "scale(0.9)", offset: 0.45 },
      { opacity: 0, transform: "scale(1)" },
    ],
    timing
  );
  done.onfinish = done.oncancel = () => box.remove();
}

// ---- Native: watch touches on the root view and draw in an overlay above the app. --------------
const TAP_MOVE = 10;
const TAP_MS = 500;

function NativeShutter({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const start = useRef<{ x: number; y: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setShutterListener((x, y) => {
      setPoint({ x, y });
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: SHUTTER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true })
        .start(({ finished }) => {
          if (finished) setPoint(null);
        });
    });
    return () => {
      setShutterListener(null);
      setPoint(null);
    };
  }, [enabled, progress]);

  // Only a real tap counts: a finger that moved (scrolling) or was held does not fire.
  const onTouchStart = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, at: Date.now() };
  };
  const onTouchEnd = (e: GestureResponderEvent) => {
    const from = start.current;
    start.current = null;
    if (!from) return;
    const { pageX, pageY } = e.nativeEvent;
    if (Math.abs(pageX - from.x) > TAP_MOVE || Math.abs(pageY - from.y) > TAP_MOVE || Date.now() - from.at > TAP_MS) return;
    fireShutter(pageX, pageY);
  };

  return (
    <View style={styles.root} onTouchStart={enabled ? onTouchStart : undefined} onTouchEnd={enabled ? onTouchEnd : undefined}>
      {children}
      {point && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.box,
            {
              left: point.x - HALF,
              top: point.y - HALF,
              opacity: progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 1, 0] }),
              transform: [{ scale: progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1.15, 0.9, 1] }) }],
            },
          ]}
        >
          <View style={styles.ring} />
          <Animated.View
            style={[
              styles.iris,
              { transform: [{ scale: progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.2, 1, 0.2] }) }] },
            ]}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  box: { position: "absolute", width: SHUTTER_SIZE, height: SHUTTER_SIZE },
  ring: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderRadius: HALF, borderWidth: 2, borderColor: RING },
  iris: { position: "absolute", left: 5, top: 5, right: 5, bottom: 5, borderRadius: HALF, backgroundColor: IRIS },
});
