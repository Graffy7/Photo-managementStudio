import { useState } from "react";
import { EventListScreen } from "../screens/studioOwner/EventListScreen";
import { EventFormScreen } from "../screens/studioOwner/EventFormScreen";
import { EventDetailScreen } from "../screens/studioOwner/EventDetailScreen";
import { PhotoSelectionManageScreen } from "../screens/studioOwner/photoSelection/PhotoSelectionManageScreen";
import type { StudioEvent } from "../types/event";

type View =
  | { name: "list" }
  | { name: "create" }
  | { name: "edit"; event: StudioEvent }
  | { name: "view"; event: StudioEvent }
  | { name: "photoSelection"; event: StudioEvent; projectId: number };

export function EventsHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <EventFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <EventFormScreen
        event={view.event}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "photoSelection") {
    return (
      <PhotoSelectionManageScreen
        projectId={view.projectId}
        onBack={() => setView({ name: "view", event: view.event })}
      />
    );
  }

  if (view.name === "view") {
    return (
      <EventDetailScreen
        event={view.event}
        onBack={() => setView({ name: "list" })}
        onEdit={() => setView({ name: "edit", event: view.event })}
        onManagePhotoSelection={(projectId) => setView({ name: "photoSelection", event: view.event, projectId })}
      />
    );
  }

  return (
    <EventListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(event) => setView({ name: "edit", event })}
      onView={(event) => setView({ name: "view", event })}
    />
  );
}
