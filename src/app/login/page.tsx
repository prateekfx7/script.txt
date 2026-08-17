"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // If already logged in, redirect to pricing
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/#pricing");
      }
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Account created! Check your email to confirm, then log in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/#pricing");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/#pricing`,
      },
    });
    if (error) setError(error.message);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <a href="/" className="font-pixel text-[32px] text-indigo leading-none mb-10 select-none hover:opacity-80 transition-opacity">
        scribe.txt
      </a>

      <div
        className="w-full max-w-[440px] bg-white border-2 border-ink rounded-[24px] p-8 sm:p-10 shadow-[6px_6px_0_#171717]"
      >
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-pt-narrow font-bold text-[30px] text-ink leading-tight mb-1">
            {mode === "login" ? "Welcome back 👋" : "Create your account"}
          </h1>
          <p className="font-pt-narrow text-[16px] text-text-gray">
            {mode === "login"
              ? "Log in to access your subscription and transcripts."
              : "Sign up for free — 7 transcripts daily on us."}
          </p>
        </div>

        {/* Google Login */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full mb-5 flex items-center justify-center gap-3 border-2 border-ink bg-white rounded-[12px] py-3 px-4 font-pt-narrow font-bold text-[16px] text-ink shadow-neo-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#171717] transition-all"
        >
          {/* Google Icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="font-pt-narrow text-[13px] text-text-gray-2">or with email</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block font-pt-narrow font-bold text-[14px] text-ink mb-1" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-2 border-ink rounded-[10px] px-4 py-3 text-[15px] font-pt-narrow bg-white outline-none focus:border-indigo transition-colors placeholder:text-text-gray-2"
            />
          </div>

          <div>
            <label className="block font-pt-narrow font-bold text-[14px] text-ink mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-2 border-ink rounded-[10px] px-4 py-3 text-[15px] font-pt-narrow bg-white outline-none focus:border-indigo transition-colors placeholder:text-text-gray-2"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border-2 border-red-300 rounded-[10px] px-4 py-2.5 text-red-700 font-pt-narrow text-[14px] font-bold">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-50 border-2 border-green-300 rounded-[10px] px-4 py-2.5 text-green-800 font-pt-narrow text-[14px] font-bold">
              {success}
            </div>
          )}

          <button
            id="auth-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full btn-neo justify-center py-3 text-[18px] bg-indigo text-white border-ink hover:bg-indigo/90 disabled:opacity-60 mt-1"
            style={{ boxShadow: "4px 4px 0 #171717" }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Log in"
              : "Create account"}
          </button>
        </form>

        {/* Mode switcher */}
        <p className="mt-6 text-center font-pt-narrow text-[15px] text-text-gray">
          {mode === "login" ? (
            <>
              No account yet?{" "}
              <button
                type="button"
                onClick={() => { setMode("signup"); setError(null); setSuccess(null); }}
                className="text-indigo font-bold hover:underline"
              >
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => { setMode("login"); setError(null); setSuccess(null); }}
                className="text-indigo font-bold hover:underline"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>

      {/* Back link */}
      <a
        href="/"
        className="mt-8 font-pt-narrow text-[14px] text-text-gray hover:text-ink transition-colors"
      >
        ← Back to scribe.txt
      </a>
    </div>
  );
}
