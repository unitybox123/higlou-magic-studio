"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resetPasswordForEmail,
  type AuthActionState,
} from "@/app/login/actions";

const initialState: AuthActionState = {};

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    resetPasswordForEmail,
    initialState,
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_50%_at_18%_-8%,rgba(255,199,44,0.05),transparent_58%),radial-gradient(55%_40%_at_92%_8%,rgba(10,10,10,0.03),transparent_52%)]"
      />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="font-[family-name:var(--font-instrument-serif)] text-3xl tracking-[-0.02em] text-zinc-950"
        >
          Higlou
        </Link>
        <p className="mt-2 text-sm tracking-[-0.01em] text-zinc-500">
          Reset access to Higlou.
        </p>

        <div className="mt-8 space-y-5 border-t border-zinc-900/8 pt-8">
          <h1 className="font-[family-name:var(--font-instrument-serif)] text-2xl tracking-[-0.02em] text-zinc-950">
            Reset password
          </h1>
          <p className="text-sm text-zinc-500">
            Enter your email and we will send a recovery link if an account
            exists.
          </p>

          {state.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          ) : null}

          {state.success ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {state.success}
            </p>
          ) : null}

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@higlou.store"
                required
                className="h-11 bg-white"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-full bg-zinc-950 text-white hover:bg-zinc-900"
              disabled={pending}
              title={pending ? "Sending…" : "Send password recovery email"}
            >
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </form>

          <div className="text-sm">
            <Link
              href="/login"
              className="text-zinc-600 underline-offset-4 hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
