import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    // Send first-time users through onboarding before the app shell.
    if (location.pathname !== "/onboarding") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, account_status")
        .eq("id", data.user.id)
        .maybeSingle();
      if (profile && profile.account_status !== "active") {
        await supabase.auth.signOut();
        throw redirect({ to: "/auth" });
      }
      if (profile && !profile.onboarding_completed) throw redirect({ to: "/onboarding" });
    }

    return { user: data.user };
  },
  component: () => <Outlet />,
});
