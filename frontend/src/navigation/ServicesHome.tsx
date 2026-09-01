import { useState } from "react";
import { ServiceListScreen } from "../screens/studioOwner/ServiceListScreen";
import { ServiceFormScreen } from "../screens/studioOwner/ServiceFormScreen";
import type { StudioService } from "../types/service";

type View = { name: "list" } | { name: "create" } | { name: "edit"; service: StudioService };

export function ServicesHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <ServiceFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <ServiceFormScreen
        service={view.service}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <ServiceListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(service) => setView({ name: "edit", service })}
    />
  );
}
