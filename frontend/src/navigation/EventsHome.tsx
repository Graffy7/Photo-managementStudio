import { useEffect, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { EventListScreen, type EventListPreset } from "../screens/studioOwner/EventListScreen";
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
  // Handed back to the returnTo page, e.g. the Calendar day that was open.
  returnParams?: object;
  // Opens one event's history straight away - the Customer page's "View" uses this.
  eventId?: number;
  // Opens the list already filtered, e.g. by the Calendar's "Weddings" tile.
  preset?: EventListPreset;
}

export function EventsHome() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [view, setView] = useState<View>({ name: "list" });
  const [createDate, setCreateDate] = useState<string | undefined>();
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [preset, setPreset] = useState<EventListPreset | null>(null);
  const [returnParams, setReturnParams] = useState<object | undefined>();

  const params = route.params as CreateParams | undefined;
  useEffect(() => {
    if (!params?.create) return;
    setView({ name: "create" });
    setCreateDate(params.date);
    setReturnTo(params.returnTo ?? null);
    navigation.setParams({ create: undefined, date: undefined, returnTo: undefined });
  }, [params?.create, params?.date, params?.returnTo, navigation]);

  // Arriving with a preset (the Calendar's tiles) shows the list filtered to it.
  useEffect(() => {
    if (!params?.preset) return;
    setPreset(params.preset);
    setView({ name: "list" });
    navigation.setParams({ preset: undefined });
  }, [params?.preset, navigation]);

  // Arriving with an eventId (from a customer's event history, or the Calendar's "View event")
  // opens that event's record; with returnTo, its Back goes back to that page.
  useEffect(() => {
    const eventId = params?.eventId;
    if (!eventId) return;
    // The param is cleared only once the event has loaded: clearing it first would re-run this
    // effect, and its cleanup would cancel the very fetch that is still in flight.
    eventsApi.getById(eventId).then((event) => {
      setView({ name: "view", event });
      setReturnTo(params?.returnTo ?? null);
      setReturnParams(params?.returnParams);
      navigation.setParams({ eventId: undefined, returnTo: undefined, returnParams: undefined });
    }).catch(() => navigation.setParams({ eventId: undefined, returnTo: undefined, returnParams: undefined }));
  }, [params?.eventId, navigation]);

  const leaveView = () => {
    setView({ name: "list" });
    if (returnTo) {
      const destination = returnTo;
      setReturnTo(null);
      setReturnParams(undefined);
      navigation.navigate(destination, returnParams);
    }
  };

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
        onBack={leaveView}
        backLabel={returnTo ?? "Events"}
        onEdit={() => { setReturnTo(null); setReturnParams(undefined); setView({ name: "edit", event: view.event }); }}
      />
    );
  }

  return (
    <EventListScreen
      onCreate={() => setView({ name: "create" })}
      onEdit={(event) => setView({ name: "edit", event })}
      onView={(event) => setView({ name: "view", event })}
      preset={preset}
      onClearPreset={() => setPreset(null)}
    />
  );
}
