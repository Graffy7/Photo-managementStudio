import { useEffect, useState } from "react";
import { useNavigation, useRoute } from "@react-navigation/native";
import { EventListScreen } from "../screens/studioOwner/EventListScreen";
import { EventFormScreen } from "../screens/studioOwner/EventFormScreen";
import { EventDetailScreen } from "../screens/studioOwner/EventDetailScreen";
import { PhotoSelectionManageScreen } from "../screens/studioOwner/photoSelection/PhotoSelectionManageScreen";
import type { StudioEvent } from "../types/event";

type View =
  | { name: "list" }
  | { name: "create" }
  | { name: "edit"; event: StudioEvent }
  | { name: "view"; event: StudioEvent }
  | { name: "photoSelection"; event: StudioEvent; projectId: number };

// Route params other screens can pass to jump straight into "create" — e.g. the Calendar's
// "Add Event" opens this module's create form, pre-filled with the selected date, and asks to be
// returned to once the event is saved or cancelled.
interface CreateParams {
  create?: boolean;
  date?: string;
  returnTo?: string;
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

  if (view.name === "photoSelection") {
    return (
      <PhotoSelectionManageScreen
        projectId={view.projectId}
        onBack={() => setView({ name: "view", event: view.event })}
      />
    );
  }

  if (view.name === "view") {
    return (
      <EventDetailScreen
        event={view.event}
        onBack={() => setView({ name: "list" })}
        onEdit={() => setView({ name: "edit", event: view.event })}
        onManagePhotoSelection={(projectId) => setView({ name: "photoSelection", event: view.event, projectId })}
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
