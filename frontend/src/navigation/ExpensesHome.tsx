import { useState } from "react";
import { ExpenseListScreen } from "../screens/studioOwner/ExpenseListScreen";
import { ExpenseFormScreen } from "../screens/studioOwner/ExpenseFormScreen";
import { ExpenseCategoryListScreen } from "../screens/studioOwner/ExpenseCategoryListScreen";
import { ExpenseCategoryFormScreen } from "../screens/studioOwner/ExpenseCategoryFormScreen";
import type { Expense } from "../types/expense";
import type { ExpenseCategory } from "../types/expenseCategory";

type View =
  | { name: "list" }
  | { name: "create" }
  | { name: "edit"; expense: Expense }
  | { name: "categories" }
  | { name: "category-create" }
  | { name: "category-edit"; category: ExpenseCategory };

export function ExpensesHome() {
  const [view, setView] = useState<View>({ name: "list" });

  if (view.name === "create") {
    return <ExpenseFormScreen onDone={() => setView({ name: "list" })} onCancel={() => setView({ name: "list" })} />;
  }

  if (view.name === "edit") {
    return (
      <ExpenseFormScreen
        expense={view.expense}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "category-create") {
    return <ExpenseCategoryFormScreen onDone={() => setView({ name: "categories" })} onCancel={() => setView({ name: "categories" })} />;
  }

  if (view.name === "category-edit") {
    return (
      <ExpenseCategoryFormScreen
        category={view.category}
        onDone={() => setView({ name: "categories" })}
        onCancel={() => setView({ name: "categories" })}
      />
    );
  }

  if (view.name === "categories") {
    return (
      <ExpenseCategoryListScreen
        onCreate={() => setView({ name: "category-create" })}
        onEdit={(category) => setView({ name: "category-edit", category })}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  return (
    <ExpenseListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(expense) => setView({ name: "edit", expense })}
      onManageCategories={() => setView({ name: "categories" })}
    />
  );
}
