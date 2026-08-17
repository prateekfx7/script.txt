import { inngest } from "../client";
import { processTranscriptionJob } from "@/lib/transcribeJobCore";

/**
 * Background Inngest function that triggers the transcription processing.
 */
export const transcribeJob = inngest.createFunction(
  {
    id: "transcribe-job",
    name: "Transcribe Job",
    retries: 2,
    event: "job/transcribe",
  },
  async ({ event, step }) => {
    const { jobId } = event.data as { jobId: string };
    await step.run("process-job", async () => {
      await processTranscriptionJob(jobId);
    });
    return { status: "completed", jobId };
  }
);
