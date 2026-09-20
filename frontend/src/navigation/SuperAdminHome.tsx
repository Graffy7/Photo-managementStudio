import { useState } from "react";
import { DashboardScreen } from "../screens/superAdmin/DashboardScreen";
import { StudioListScreen } from "../screens/superAdmin/StudioListScreen";
import { StudioFormScreen } from "../screens/superAdmin/StudioFormScreen";
import { StudioDetailScreen } from "../screens/superAdmin/StudioDetailScreen";
import { AuditLogScreen } from "../screens/superAdmin/AuditLogScreen";
import { StudioFeaturesScreen } from "../screens/superAdmin/StudioFeaturesScreen";
import { RenewSubscriptionScreen } from "../screens/superAdmin/RenewSubscriptionScreen";
import type { Studio } from "../types/studio";

type View =
  | { name: "dashboard" }
  | { name: "list" }
  | { name: "create" }
  | { name: "view"; studio: Studio }
  | { name: "edit"; studio: Studio }
  | { name: "activity" }
  | { name: "features"; studio: Studio }
  | { name: "renew"; studio: Studio };

export function SuperAdminHome() {
  const [view, setView] = useState<View>({ name: "dashboard" });

  if (view.name === "dashboard") {
    return <DashboardScreen onViewStudios={() => setView({ name: "list" })} />;
  }

  if (view.name === "create") {
    return <StudioFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "view") {
    return (
      <StudioDetailScreen
        studio={view.studio}
        onBack={() => setView({ name: "list" })}
        onEdit={(studio) => setView({ name: "edit", studio })}
      />
    );
  }

  if (view.name === "edit") {
    return (
      <StudioFormScreen
        studio={view.studio}
        onDone={() => setView({ name: "view", studio: view.studio })}
        onCancel={() => setView({ name: "view", studio: view.studio })}
      />
    );
  }

  if (view.name === "activity") {
    return <AuditLogScreen onBack={() => setView({ name: "list" })} />;
  }

  if (view.name === "features") {
    return <StudioFeaturesScreen studio={view.studio} onBack={() => setView({ name: "list" })} />;
  }

  if (view.name === "renew") {
    return (
      <RenewSubscriptionScreen
        studio={view.studio}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <StudioListScreen
      onCreate={() => setView({ name: "create" })}
      onView={(studio) => setView({ name: "view", studio })}
      onEdit={(studio) => setView({ name: "edit", studio })}
      onViewActivity={() => setView({ name: "activity" })}
      onManageFeatures={(studio) => setView({ name: "features", studio })}
      onRenew={(studio) => setView({ name: "renew", studio })}
      onViewDashboard={() => setView({ name: "dashboard" })}
    />
  );
}
