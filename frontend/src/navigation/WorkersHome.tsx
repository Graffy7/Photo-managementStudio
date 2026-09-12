import { useState } from "react";
import { WorkerListScreen } from "../screens/studioOwner/WorkerListScreen";
import { WorkerFormScreen } from "../screens/studioOwner/WorkerFormScreen";
import { WorkerDetailScreen } from "../screens/studioOwner/WorkerDetailScreen";
import type { Worker } from "../types/worker";

type View = { name: "list" } | { name: "create" } | { name: "edit"; worker: Worker } | { name: "view"; worker: Worker };

export function WorkersHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <WorkerFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <WorkerFormScreen
        worker={view.worker}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "view") {
    return (
      <WorkerDetailScreen
        worker={view.worker}
        onBack={() => setView({ name: "list" })}
        onEdit={() => setView({ name: "edit", worker: view.worker })}
      />
    );
  }

  return (
    <WorkerListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(worker) => setView({ name: "edit", worker })}
      onView={(worker) => setView({ name: "view", worker })}
    />
  );
}
