"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signInAction, signingIn] = useActionState<AuthState, FormData>(signIn, {});
  const [signUpState, signUpAction, signingUp] = useActionState<AuthState, FormData>(signUp, {});
  const state = mode === "signin" ? signInState : signUpState;
  const pending = signingIn || signingUp;

  return (
    <form action={mode === "signin" ? signInAction : signUpAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-medium text-ink-2">Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1.5 block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-ink-2">Password</span>
        <input
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          required
          minLength={mode === "signup" ? 8 : undefined}
          className="mt-1.5 block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-critical">
          {state.error}
        </p>
      )}
      {state.message && <p className="text-sm text-good-ink">{state.message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-ink px-3 py-2 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <p className="text-center text-sm text-ink-3">
        {mode === "signin" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-medium text-accent-ink hover:underline"
        >
          {mode === "signin" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </form>
  );
}
