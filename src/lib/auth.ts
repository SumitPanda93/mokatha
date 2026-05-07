import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

let cachedSession: Session | null = null;
let cachedUser: User | null = null;
let initialized = false;

const listeners = new Set<() => void>();
function emit() {
  for (const fn of listeners) fn();
}

export function getAuthSession() {
  return cachedSession;
}

export function getAuthUser() {
  return cachedUser;
}

export function getAuthUserId() {
  return cachedUser?.id ?? "";
}

export async function initAuth(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const { data } = await supabase.auth.getSession();
  cachedSession = data.session ?? null;
  cachedUser = data.session?.user ?? null;
  emit();

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session ?? null;
    cachedUser = session?.user ?? null;
    emit();
  });
}

export function useAuthState() {
  const [session, setSession] = useState<Session | null>(() => getAuthSession());
  const [user, setUser] = useState<User | null>(() => getAuthUser());
  const [ready, setReady] = useState(() => initialized);

  useEffect(() => {
    let mounted = true;
    initAuth().finally(() => {
      if (mounted) setReady(true);
    });

    const onChange = () => {
      if (!mounted) return;
      setSession(getAuthSession());
      setUser(getAuthUser());
    };
    listeners.add(onChange);
    return () => {
      mounted = false;
      listeners.delete(onChange);
    };
  }, []);

  return { ready, session, user, userId: user?.id ?? "" };
}

