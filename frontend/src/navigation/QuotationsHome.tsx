import { useState } from "react";
import { QuotationListScreen } from "../screens/studioOwner/QuotationListScreen";
import { QuotationFormScreen } from "../screens/studioOwner/QuotationFormScreen";
import type { Quotation } from "../types/quotation";

type View = { name: "list" } | { name: "create" } | { name: "edit"; quotation: Quotation };

export function QuotationsHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <QuotationFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <QuotationFormScreen
        quotation={view.quotation}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <QuotationListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(quotation) => setView({ name: "edit", quotation })}
    />
  );
}
