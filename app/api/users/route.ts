import { NextResponse } from "next/server";
import { listVolumeUsers } from "@/lib/modal-data";

export async function GET() {
  try {
    const users = await listVolumeUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[users][list]", error);
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}
