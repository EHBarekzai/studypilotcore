import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendPasswordReset } from "@/hooks/useAuth";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — StudyPilot" },
      { name: "description", content: "Request a password reset link for your StudyPilot account." },
      { property: "og:title", content: "Reset your password — StudyPilot" },
      {
        property: "og:description",
        content: "Request a password reset link for your StudyPilot account.",
      },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const { error } = await sendPasswordReset(email.trim());
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl px-4 py-5">
        <Link to="/">
          <Brand />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 pb-16">
        <div className="surface-card p-6">
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          {sent ? (
            <p className="mt-3 text-sm text-muted-foreground">
              If an account exists for <span className="font-medium">{email}</span>, a reset link is
              on its way. Check your inbox and spam folder.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a secure link to choose a new password.
              </p>
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            </>
          )}
          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link to="/auth" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
