import { NextRequest, NextResponse } from "next/server";
import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { transcribeJob } from "@/inngest/functions/transcribeJob";

const handler = serve({
  client: inngest,
  functions: [transcribeJob],
});

export const GET = handler.GET;
export const POST = handler.POST;
export const PUT = handler.PUT;
