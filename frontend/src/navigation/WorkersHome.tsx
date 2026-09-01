import { useState } from "react";
import { WorkerListScreen } from "../screens/studioOwner/WorkerListScreen";
import { WorkerFormScreen } from "../screens/studioOwner/WorkerFormScreen";
import type { Worker } from "../types/worker";

type View = { name: "list" } | { name: "create" } | { name: "edit"; worker: Worker };

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

  return (
    <WorkerListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(worker) => setView({ name: "edit", worker })}
    />
  );
}
