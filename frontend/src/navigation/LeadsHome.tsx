import { useState } from "react";
import { LeadListScreen } from "../screens/studioOwner/LeadListScreen";
import { LeadFormScreen } from "../screens/studioOwner/LeadFormScreen";
import { LeadDetailScreen } from "../screens/studioOwner/LeadDetailScreen";
import type { Lead } from "../types/lead";

type View = { name: "list" } | { name: "create" } | { name: "edit"; lead: Lead } | { name: "view"; lead: Lead };

export function LeadsHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <LeadFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <LeadFormScreen
        lead={view.lead}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "view") {
    return (
      <LeadDetailScreen
        lead={view.lead}
        onBack={() => setView({ name: "list" })}
        onEdit={() => setView({ name: "edit", lead: view.lead })}
      />
    );
  }

  return (
    <LeadListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(lead) => setView({ name: "edit", lead })}
      onView={(lead) => setView({ name: "view", lead })}
    />
  );
}
