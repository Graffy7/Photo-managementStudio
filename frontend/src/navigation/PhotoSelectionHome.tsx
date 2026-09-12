import { useState } from "react";
import { PhotoSelectionListScreen } from "../screens/studioOwner/photoSelection/PhotoSelectionListScreen";
import { PhotoSelectionManageScreen } from "../screens/studioOwner/photoSelection/PhotoSelectionManageScreen";

type View = { name: "list" } | { name: "manage"; projectId: number };

export function PhotoSelectionHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "manage") {
    return <PhotoSelectionManageScreen projectId={view.projectId} onBack={() => setView({ name: "list" })} />;
  }

  return <PhotoSelectionListScreen onManage={(projectId) => setView({ name: "manage", projectId })} />;
}
