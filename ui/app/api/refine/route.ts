import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const requestBody = await request.json();

    const refinementEndpoint = `${process.env.REFINEMENT_ENDPOINT}/refine`;
    const fileId = requestBody.file_id;
    const encryptionKey = requestBody.encryption_key;
    const refinerId = process.env.REFINER_ID || requestBody.refiner_id;
    const pinataApiKey = process.env.PINATA_API_KEY;
    const pinataApiSecret = process.env.PINATA_API_SECRET;

    if (!refinementEndpoint) {
      return NextResponse.json(
        { error: "Refinement endpoint not configured" },
        { status: 500 }
      );
    }

    if (!fileId || !encryptionKey) {
      return NextResponse.json(
        { error: "Missing required parameters: file_id or encryption_key" },
        { status: 400 }
      );
    }

    const payload = {
      file_id: fileId,
      encryption_key: encryptionKey,
      refiner_id: refinerId,
      env_vars: {
        PINATA_API_KEY: pinataApiKey,
        PINATA_API_SECRET: pinataApiSecret,
      },
    };

    const response = await fetch(refinementEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error in refinement process:", error);
    return NextResponse.json(
      { error: "Failed to process refinement request" },
      { status: 500 }
    );
  }
}
