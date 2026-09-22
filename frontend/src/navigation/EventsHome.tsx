import { useEffect, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { EventListScreen } from "../screens/studioOwner/EventListScreen";
import { EventFormScreen } from "../screens/studioOwner/EventFormScreen";
import { EventDetailScreen } from "../screens/studioOwner/EventDetailScreen";
import { eventsApi } from "../api/eventsApi";
import type { StudioEvent } from "../types/event";

type View =
  | { name: "list" }
  | { name: "create" }
  | { name: "edit"; event: StudioEvent }
  | { name: "view"; event: StudioEvent };

// Route params other screens can pass to jump straight into "create" — e.g. the Calendar's
// "Add Event" opens this module's create form, pre-filled with the selected date, and asks to be
// returned to once the event is saved or cancelled.
interface CreateParams {
  create?: boolean;
  date?: string;
  returnTo?: string;
  // Opens one event's history straight away - the Customer page's "View" uses this.
  eventId?: number;
}

export function EventsHome() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [view, setView] = useState<View>({ name: "list" });
  const [createDate, setCreateDate] = useState<string | undefined>();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  const params = route.params as CreateParams | undefined;
  useEffect(() => {
    if (!params?.create) return;
    setView({ name: "create" });
    setCreateDate(params.date);
    setReturnTo(params.returnTo ?? null);
    navigation.setParams({ create: undefined, date: undefined, returnTo: undefined });
  }, [params?.create, params?.date, params?.returnTo, navigation]);

  // Arriving with an eventId (from a customer's event history) opens that event's record.
  useEffect(() => {
    const eventId = params?.eventId;
    if (!eventId) return;
    // The param is cleared only once the event has loaded: clearing it first would re-run this
    // effect, and its cleanup would cancel the very fetch that is still in flight.
    eventsApi.getById(eventId).then((event) => {
      setView({ name: "view", event });
      navigation.setParams({ eventId: undefined });
    }).catch(() => navigation.setParams({ eventId: undefined }));
  }, [params?.eventId, navigation]);

  const finishCreate = () => {
    setView({ name: "list" });
    setCreateDate(undefined);
    if (returnTo) {
      const destination = returnTo;
      setReturnTo(null);
      navigation.navigate(destination);
    }
  };

  if (view.name === "create") {
    return <EventFormScreen initialEventDate={createDate} onDone={finishCreate} onCancel={finishCreate} />;
  }

  if (view.name === "edit") {
    return (
      <EventFormScreen
        event={view.event}
        onDone={() => setView({ name: "list" })}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }

  if (view.name === "view") {
    return (
      <EventDetailScreen
        event={view.event}
        onBack={() => setView({ name: "list" })}
        onEdit={() => setView({ name: "edit", event: view.event })}
      />
    );
  }

  return (
    <EventListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(event) => setView({ name: "edit", event })}
      onView={(event) => setView({ name: "view", event })}
    />
  );
}
