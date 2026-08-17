"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuth = async () => {
      const code = searchParams.get("code");
      const next = searchParams.get("next") || "/#pricing";

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error("Error exchanging code for session:", error);
            router.replace(`/login?error=${encodeURIComponent(error.message)}`);
            return;
          }
          router.replace(next);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Authentication error";
          router.replace(`/login?error=${encodeURIComponent(msg)}`);
        }
      } else {
        // Handle hash or existing session
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.replace(next);
        } else {
          router.replace("/login");
        }
      }
    };

    handleAuth();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 border-4 border-indigo border-t-transparent rounded-full animate-spin mb-4" />
      <h2 className="font-pt-narrow font-bold text-[24px] text-ink">Completing login...</h2>
      <p className="font-pt-narrow text-[15px] text-text-gray mt-1">
        Please wait while we authenticate your session.
      </p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-indigo border-t-transparent rounded-full animate-spin mb-4" />
          <p className="font-pt-narrow font-bold text-[18px] text-ink">Loading...</p>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
