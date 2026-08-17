"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type JobStatus = "pending" | "processing" | "done" | "failed";

interface JobData {
  id: string;
  fileName: string;
  status: JobStatus;
  errorMsg?: string | null;
}

const statusConfig: Record<JobStatus, { label: string; color: string; icon: JSX.Element }> = {
  pending: {
    label: "waiting to start…",
    color: "text-text-gray",
    icon: (
      <div className="w-12 h-12 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
    ),
  },
  processing: {
    label: "transcribing your file…",
    color: "text-indigo",
    icon: (
      <div className="w-12 h-12 border-2 border-indigo border-t-transparent rounded-full animate-spin mx-auto" />
    ),
  },
  done: {
    label: "transcript ready!",
    color: "text-green",
    icon: (
      <div className="w-12 h-12 rounded-full border-2 border-green flex items-center justify-center mx-auto text-green">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>
    ),
  },
  failed: {
    label: "transcription failed",
    color: "text-red-600",
    icon: (
      <div className="w-12 h-12 rounded-full border-2 border-red-500 flex items-center justify-center mx-auto text-red-500">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </div>
    ),
  },
};

export default function JobStatusPage({ params }: { params: { id: string } }) {
  const [job, setJob] = useState<JobData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${params.id}`);
        if (!active) return;
        if (res.status === 404) {
          setError("Job not found.");
          return;
        }
        if (!res.ok) {
          setError("Failed to fetch job status.");
          return;
        }
        const data: JobData = await res.json();
        setJob(data);

        if (data.status === "done") {
          // Small delay so user sees the green "ready" state before redirect
          setTimeout(() => {
            if (active) router.push(`/transcript/${params.id}`);
          }, 800);
        }
      } catch {
        if (active) setError("Network error while checking status.");
      }
    };

    // Immediate first poll
    poll();
    // Then poll every 2 seconds
    const interval = setInterval(() => {
      if (job?.status !== "done" && job?.status !== "failed") {
        poll();
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [params.id, router]);

  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(`/api/jobs/${params.id}/retry`, { method: "POST" });
      if (res.ok) {
        setJob((j) => (j ? { ...j, status: "pending", errorMsg: null } : null));
      }
    } catch {}
    setRetrying(false);
  };

  const config = job ? statusConfig[job.status] : null;

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <a href="/" className="font-pixel text-[28px] text-indigo mb-16 block">
        scribe.txt
      </a>

      <div className="card-neo w-full max-w-md p-10 text-center">
        {error ? (
          <div>
            <p className="text-red-600 font-medium text-[15px]">{error}</p>
            <a href="/" className="btn-neo mt-6 inline-flex">← back to home</a>
          </div>
        ) : !job ? (
          <div className="w-12 h-12 border-2 border-ink border-t-transparent rounded-full animate-spin mx-auto" />
        ) : (
          <>
            <div className="mb-6">{config?.icon}</div>

            <h2 className="font-display font-extrabold text-[22px] text-ink mb-2">
              {config?.label}
            </h2>

            <p className="text-[14px] text-text-gray mb-1 truncate">
              {job.fileName}
            </p>

            {job.status === "failed" && job.errorMsg && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-[10px] text-left">
                <p className="text-[13px] text-red-700 leading-relaxed">{job.errorMsg}</p>
              </div>
            )}

            {job.status === "failed" && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                <button
                  id="retry-job-btn"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="btn-neo justify-center disabled:opacity-50"
                >
                  {retrying ? "retrying…" : "⚡ retry transcription"}
                </button>
                <a href="/" className="btn-neo-white justify-center">
                  ← try another file
                </a>
              </div>
            )}

            {(job.status === "pending" || job.status === "processing") && (
              <div className="mt-6">
                {/* Animated progress dots */}
                <div className="flex justify-center gap-2">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-full bg-indigo animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-[12px] text-text-gray-2 mt-3">
                  longer files may take a minute or two
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
