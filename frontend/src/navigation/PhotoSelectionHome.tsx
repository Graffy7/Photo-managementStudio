import { useState } from "react";
import { PhotoSelectionListScreen } from "../screens/studioOwner/PhotoSelectionListScreen";
import { PhotoGalleryManageScreen } from "../screens/studioOwner/PhotoGalleryManageScreen";

type View = { name: "list" } | { name: "manage"; eventId: number };

export function PhotoSelectionHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "manage") {
    return <PhotoGalleryManageScreen eventId={view.eventId} onBack={() => setView({ name: "list" })} />;
  }

  return <PhotoSelectionListScreen onOpen={(eventId) => setView({ name: "manage", eventId })} />;
}
