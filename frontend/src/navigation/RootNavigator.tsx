import { useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "../auth/authStore";
import { WebAppShell } from "./WebAppShell";
import { LoginScreen } from "../screens/auth/LoginScreen";
import { ForgotPasswordScreen } from "../screens/auth/ForgotPasswordScreen";
import { ResetPasswordScreen } from "../screens/auth/ResetPasswordScreen";
import { ChangePasswordScreen } from "../screens/ChangePasswordScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { SettingsScreen } from "../screens/studioOwner/SettingsScreen";
import { LookupsScreen } from "../screens/studioOwner/LookupsScreen";
import { LeadFormConfigScreen } from "../screens/studioOwner/LeadFormConfigScreen";
import { LeadsHome } from "./LeadsHome";
import { CustomersHome } from "./CustomersHome";
import { EventsHome } from "./EventsHome";
import { WorkersHome } from "./WorkersHome";
import { ServicesHome } from "./ServicesHome";
import { QuotationsHome } from "./QuotationsHome";
import { PaymentsHome } from "./PaymentsHome";
import { ExpensesHome } from "./ExpensesHome";
import { PhotoSelectionHome } from "./PhotoSelectionHome";
import { ReportsScreen } from "../screens/studioOwner/ReportsScreen";
import { DayBoardScreen } from "../screens/studioOwner/DayBoardScreen";
import { CalendarScreen } from "../screens/studioOwner/CalendarScreen";
import { NotificationsScreen } from "../screens/studioOwner/NotificationsScreen";
import { ActivityScreen } from "../screens/studioOwner/ActivityScreen";
import { SuperAdminHome } from "./SuperAdminHome";
import { withModule } from "./ModuleGate";
import { SubscriptionGate, SubscriptionScreen } from "../screens/studioOwner/subscription/SubscriptionScreens";

const Stack = createNativeStackNavigator();


// Each module screen is shut off when the platform admin switches that module off for the studio.
const GatedLeadsHome = withModule("LEADS", LeadsHome);
const GatedCustomersHome = withModule("CUSTOMERS", CustomersHome);
const GatedEventsHome = withModule("EVENTS", EventsHome);
const GatedWorkersHome = withModule("WORKERS", WorkersHome);
const GatedServicesHome = withModule("SERVICES", ServicesHome);
const GatedQuotationsHome = withModule("QUOTATIONS", QuotationsHome);
const GatedPaymentsHome = withModule("PAYMENTS", PaymentsHome);
const GatedExpensesHome = withModule("EXPENSES", ExpensesHome);
const GatedPhotoSelectionHome = withModule("PHOTO_SELECTION", PhotoSelectionHome);
const GatedReportsScreen = withModule("REPORTS", ReportsScreen);
const GatedDayBoardScreen = withModule("DAY_BOARD", DayBoardScreen);
const GatedCalendarScreen = withModule("EVENTS", CalendarScreen);
const GatedNotificationsScreen = withModule("NOTIFICATIONS", NotificationsScreen);
const GatedSettingsScreen = withModule("SETTINGS", SettingsScreen);
const GatedLookupsScreen = withModule("SETTINGS", LookupsScreen);
const GatedLeadFormConfigScreen = withModule("SETTINGS", LeadFormConfigScreen);

export function RootNavigator() {
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const user = useAuthStore((s) => s.user);
  const navigationRef = useNavigationContainerRef<Record<string, object | undefined>>();
  const [activeRoute, setActiveRoute] = useState("Home");

  if (isHydrating) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color="#ff9a4d" size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onStateChange={() => setActiveRoute(navigationRef.getCurrentRoute()?.name ?? "Home")}
    >
      {!user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Navigator>
      ) : user.userType === "SUPER_ADMIN" ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SuperAdminHome" component={SuperAdminHome} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        </Stack.Navigator>
      ) : (
        // An expired subscription replaces the whole app with the renewal page (the server refuses
        // everything else anyway).
        <SubscriptionGate>
        <WebAppShell navigationRef={navigationRef} activeRoute={activeRoute}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Leads" component={GatedLeadsHome} />
            <Stack.Screen name="Customers" component={GatedCustomersHome} />
            <Stack.Screen name="Events" component={GatedEventsHome} />
            <Stack.Screen name="Workers" component={GatedWorkersHome} />
            <Stack.Screen name="Services" component={GatedServicesHome} />
            <Stack.Screen name="Quotations" component={GatedQuotationsHome} />
            <Stack.Screen name="Payments" component={GatedPaymentsHome} />
            <Stack.Screen name="Expenses" component={GatedExpensesHome} />
            <Stack.Screen name="PhotoSelection" component={GatedPhotoSelectionHome} />
            <Stack.Screen name="Reports" component={GatedReportsScreen} />
            <Stack.Screen name="DayBoard" component={GatedDayBoardScreen} />
            <Stack.Screen name="Calendar" component={GatedCalendarScreen} />
            <Stack.Screen name="Notifications" component={GatedNotificationsScreen} />
            <Stack.Screen name="Activity" component={ActivityScreen} />
            <Stack.Screen name="Settings" component={GatedSettingsScreen} />
            <Stack.Screen name="Lookups" component={GatedLookupsScreen} />
            <Stack.Screen name="LeadFormConfig" component={GatedLeadFormConfigScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
            <Stack.Screen name="Subscription" component={SubscriptionScreen} />
          </Stack.Navigator>
        </WebAppShell>
        </SubscriptionGate>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: "#0d1826",
    alignItems: "center",
    justifyContent: "center",
  },
});
