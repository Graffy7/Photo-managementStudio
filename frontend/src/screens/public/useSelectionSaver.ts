import { useCallback, useRef, useState } from "react";
import { publicPhotoSelectionApi, toPublicError, type PublicFailure } from "../../api/photoSelectionApi";
import type { GalleryCounts, PublicPhoto, SelectionType } from "../../types/photoSelection";

export interface SaveError {
  message: string;
  kind: PublicFailure;
  retry?: () => void;
}

// Moves one photo between "not selected" / Normal / Big in a counts object — the same arithmetic
// the server does, so the summary bar can update the instant a photo is tapped.
function adjustCounts(counts: GalleryCounts, from: SelectionType | null, to: SelectionType | null): GalleryCounts {
  let normal = counts.normal;
  let big = counts.big;
  if (from === 1) normal--;
  if (from === 2) big--;
  if (to === 1) normal++;
  if (to === 2) big++;
  const selected = normal + big;
  return { total: counts.total, normal, big, selected, notSelected: counts.total - selected };
}

// Owns the customer's selection while the page is open.
//  - Optimistic: a tap changes the photo and the counters immediately.
//  - Ordered: saves go to the server one at a time, in tap order, so a quick Normal -> Big -> Normal
//    can't land out of order.
//  - Honest: if a save fails the photo and counters roll back and an error (with Retry) is raised;
//    the server's own counters replace the local ones whenever the queue is idle.
export function useSelectionSaver(
  token: string,
  initialCounts: GalleryCounts,
  callbacks: { onLocked: () => void; onAccessLost: (kind: "invalid" | "expired") => void; onSaved: () => void }
) {
  const [overrides, setOverrides] = useState<Record<number, SelectionType | null>>({});
  const [counts, setCounts] = useState<GalleryCounts>(initialCounts);
  const [error, setError] = useState<SaveError | null>(null);

  const overridesRef = useRef(overrides);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingRef = useRef(0);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const effective = useCallback(
    (photo: PublicPhoto): SelectionType | null =>
      photo.photoId in overridesRef.current ? overridesRef.current[photo.photoId] : photo.selectionType,
    // overrides is a dependency so consumers re-render (and re-read) when a selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overrides]
  );

  const apply = (photoId: number, value: SelectionType | null) => {
    overridesRef.current = { ...overridesRef.current, [photoId]: value };
    setOverrides(overridesRef.current);
  };

  const setSelection = useCallback((photo: PublicPhoto, next: SelectionType | null) => {
    const previous: SelectionType | null =
      photo.photoId in overridesRef.current ? overridesRef.current[photo.photoId] : photo.selectionType;
    if (previous === next) return;

    setError(null);
    apply(photo.photoId, next);
    setCounts((c) => adjustCounts(c, previous, next));
    pendingRef.current++;

    queueRef.current = queueRef.current.then(async () => {
      try {
        const result = next === null
          ? await publicPhotoSelectionApi.unselect(token, photo.photoId)
          : await publicPhotoSelectionApi.select(token, photo.photoId, next);
        pendingRef.current--;
        if (pendingRef.current === 0) setCounts(result.counts);
        callbacksRef.current.onSaved();
      } catch (err) {
        pendingRef.current--;
        const failure = toPublicError(err);

        apply(photo.photoId, previous);
        setCounts((c) => adjustCounts(c, next, previous));

        if (failure.kind === "locked") {
          callbacksRef.current.onLocked();
        } else if (failure.kind === "invalid" || failure.kind === "expired") {
          callbacksRef.current.onAccessLost(failure.kind);
        }
        setError({
          kind: failure.kind,
          message: failure.message,
          retry: failure.kind === "offline" || failure.kind === "error" ? () => setSelection(photo, next) : undefined,
        });
      }
    });
  }, [token]);

  // Resolves once every queued save has finished (used before submitting).
  const flush = useCallback(() => queueRef.current, []);

  return {
    effective,
    setSelection,
    counts,
    setCounts,
    error,
    dismissError: () => setError(null),
    flush,
  };
}
