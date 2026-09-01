import { useState } from "react";
import { PaymentListScreen } from "../screens/studioOwner/PaymentListScreen";
import { PaymentFormScreen } from "../screens/studioOwner/PaymentFormScreen";
import type { Payment } from "../types/payment";

type View = { name: "list" } | { name: "create" } | { name: "edit"; payment: Payment };

export function PaymentsHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <PaymentFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <PaymentFormScreen
        payment={view.payment}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <PaymentListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(payment) => setView({ name: "edit", payment })}
    />
  );
}
