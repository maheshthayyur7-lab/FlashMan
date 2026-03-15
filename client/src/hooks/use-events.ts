import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useLocation } from "wouter";
import { type InsertEvent } from "@shared/schema";

export function useCreateEvent() {
  return useMutation({
    mutationFn: async (data: InsertEvent) => {
      const validated = api.events.create.input.parse(data);
      const res = await fetch(api.events.create.path, {
        method: api.events.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.events.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create event");
      }
      return api.events.create.responses[201].parse(await res.json());
    },
  });
}

export function useJoinEvent() {
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async (pin: string) => {
      if (!pin || pin.length !== 9) throw new Error("PIN must be 8 digits + 1 letter");
      
      const url = buildUrl(api.events.join.path, { pin });
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 404) throw new Error("Event not found");
        throw new Error("Failed to join event");
      }
      
      return api.events.join.responses[200].parse(await res.json());
    },
    onSuccess: (event) => {
      // Navigate to attendee mode
      setLocation(`/join/${event.id}`);
    },
  });
}

export function useHostLogin() {
  const [, setLocation] = useLocation();

  return useMutation({
    mutationFn: async ({ eventId, password }: { eventId: string; password: string }) => {
      const url = buildUrl(api.events.hostLogin.path, { id: eventId, password });
      const res = await fetch(url, { credentials: "include" });
      
      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid Event ID or Password");
        if (res.status === 404) throw new Error("Event not found");
        throw new Error("Failed to login");
      }
      
      return api.events.hostLogin.responses[200].parse(await res.json());
    },
    onSuccess: (event) => {
      // Navigate to host dashboard using Host ID (UUID)
      setLocation(`/host/${event.hostId}`);
    },
  });
}

export function useEvent(id: number | string) {
  return useQuery({
    queryKey: [api.events.get.path, id],
    queryFn: async () => {
      let url = '';
      
      // If id is a number, use numeric endpoint; if string (UUID), use hostId endpoint
      if (typeof id === 'number') {
        url = buildUrl(api.events.get.path, { id });
      } else {
        // Assume it's a host ID (UUID string)
        url = `/api/events/host/${id}`;
      }
      
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch event");
      
      return api.events.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}
