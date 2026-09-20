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

const Stack = createNativeStackNavigator();

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
        <WebAppShell navigationRef={navigationRef} activeRoute={activeRoute}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Leads" component={LeadsHome} />
            <Stack.Screen name="Customers" component={CustomersHome} />
            <Stack.Screen name="Events" component={EventsHome} />
            <Stack.Screen name="Workers" component={WorkersHome} />
            <Stack.Screen name="Services" component={ServicesHome} />
            <Stack.Screen name="Quotations" component={QuotationsHome} />
            <Stack.Screen name="Payments" component={PaymentsHome} />
            <Stack.Screen name="Expenses" component={ExpensesHome} />
            <Stack.Screen name="PhotoSelection" component={PhotoSelectionHome} />
            <Stack.Screen name="Reports" component={ReportsScreen} />
            <Stack.Screen name="DayBoard" component={DayBoardScreen} />
            <Stack.Screen name="Calendar" component={CalendarScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Activity" component={ActivityScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Lookups" component={LookupsScreen} />
            <Stack.Screen name="LeadFormConfig" component={LeadFormConfigScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </Stack.Navigator>
        </WebAppShell>
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
