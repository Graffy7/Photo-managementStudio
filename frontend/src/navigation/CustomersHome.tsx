import { useState } from "react";
import { CustomerListScreen } from "../screens/studioOwner/CustomerListScreen";
import { CustomerFormScreen } from "../screens/studioOwner/CustomerFormScreen";
import { CustomerDetailScreen } from "../screens/studioOwner/CustomerDetailScreen";
import type { Customer } from "../types/customer";

type View = { name: "list" } | { name: "create" } | { name: "edit"; customer: Customer } | { name: "view"; customer: Customer };

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

  if (view.name === "view") {
    return (
      <CustomerDetailScreen
        customer={view.customer}
        onBack={() => setView({ name: "list" })}
        onEdit={() => setView({ name: "edit", customer: view.customer })}
      />
    );
  }

  return (
    <CustomerListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(customer) => setView({ name: "edit", customer })}
      onView={(customer) => setView({ name: "view", customer })}
    />
  );
}
