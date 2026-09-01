import { useState } from "react";
import { EventListScreen } from "../screens/studioOwner/EventListScreen";
import { EventFormScreen } from "../screens/studioOwner/EventFormScreen";
import type { StudioEvent } from "../types/event";

type View = { name: "list" } | { name: "create" } | { name: "edit"; event: StudioEvent };

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

  return (
    <EventListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(event) => setView({ name: "edit", event })}
    />
  );
}
