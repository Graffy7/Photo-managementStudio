import { createAudioPlayer, type AudioPlayer, type AudioSource } from "expo-audio";

// A short sound effect. The player is created on first use and re-used afterwards. Sound is a
// nicety: if the device can't play it (or the browser hasn't been clicked yet, which it requires
// before allowing sound), Camera Mode carries on silently.
function soundEffect(source: AudioSource, volume: number): () => void {
  let player: AudioPlayer | null = null;
  let unavailable = false;

  return () => {
    if (unavailable) return;
    try {
      if (!player) {
        player = createAudioPlayer(source);
        player.volume = volume;
      } else {
        player.seekTo(0).catch(() => {});
      }
      player.play();
    } catch {
      unavailable = true;
    }
  };
}

// The shutter click on a tap.
export const playShutterSound = soundEffect(require("../../assets/sounds/shutter.wav"), 0.6);

// The double beep when focus locks.
export const playFocusSound = soundEffect(require("../../assets/sounds/focus.wav"), 0.35);
