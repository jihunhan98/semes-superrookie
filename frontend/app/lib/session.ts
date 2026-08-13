import type { User } from "./api";

const KEY = "reqops:user";

export function getCurrentUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export function setCurrentUser(user: User) {
  sessionStorage.setItem(KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  sessionStorage.removeItem(KEY);
}
