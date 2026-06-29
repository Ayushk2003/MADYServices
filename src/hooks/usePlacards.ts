import { useEffect, useState } from "react";
import {
  defaultServicePlacards,
  serviceIconMap,
  type ServiceIconKey,
  type ServicePlacard,
} from "../data/siteContent";
import { supabase } from "../supabaseClient";

export const placardColumns =
  "id,title,eyebrow,description,icon_key,points,is_active,sort_order,created_at,updated_at";

type StoredServicePlacard = Omit<ServicePlacard, "icon">;

const hydratePlacard = (placard: StoredServicePlacard): ServicePlacard => ({
  ...placard,
  icon: serviceIconMap[placard.icon_key] || serviceIconMap.website,
});

const sortPlacards = (placards: ServicePlacard[]) =>
  [...placards].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));

export const hydrateServicePlacards = (placards: StoredServicePlacard[]) =>
  sortPlacards(
    placards.map((placard) =>
      hydratePlacard({
        ...placard,
        icon_key: (placard.icon_key || "website") as ServiceIconKey,
        points: Array.isArray(placard.points) ? placard.points : [],
      }),
    ),
  );

export function usePublicPlacards() {
  const [placards, setPlacards] = useState<ServicePlacard[]>(defaultServicePlacards);

  useEffect(() => {
    if (!supabase) {
      setPlacards(defaultServicePlacards);
      return;
    }

    let isMounted = true;

    void supabase
      .from("service_placards")
      .select(placardColumns)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;

        if (error || !data || data.length === 0) {
          setPlacards(defaultServicePlacards);
          return;
        }

        setPlacards(hydrateServicePlacards(data as StoredServicePlacard[]));
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return placards;
}

export { defaultServicePlacards };
