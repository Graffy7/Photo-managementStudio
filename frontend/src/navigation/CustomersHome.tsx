import { useState } from "react";
import { CustomerListScreen } from "../screens/studioOwner/CustomerListScreen";
import { CustomerFormScreen } from "../screens/studioOwner/CustomerFormScreen";
import type { Customer } from "../types/customer";

type View = { name: "list" } | { name: "create" } | { name: "edit"; customer: Customer };

export function CustomersHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <CustomerFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <CustomerFormScreen
        customer={view.customer}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <CustomerListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(customer) => setView({ name: "edit", customer })}
    />
  );
}
