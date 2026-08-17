import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, STORAGE_BUCKET } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const { fileName, contentType } = await req.json();

    if (!fileName || !contentType) {
      return NextResponse.json({ error: "fileName and contentType are required" }, { status: 400 });
    }

    // Generate a unique storage path to avoid collisions
    const ext = fileName.split(".").pop() ?? "bin";
    const storagePath = `uploads/${uuidv4()}.${ext}`;

    // Create a signed upload URL (expires in 60 minutes)
    const { data, error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      console.error("Supabase signed URL error:", error);
      return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
    }

    // Build the public URL for the uploaded file
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      publicUrl,
      storagePath,
    });
  } catch (err) {
    console.error("upload-url route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
