import { NextResponse } from "next/server";
import { listUsers } from "@/lib/storage-data";

export async function GET() {
  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error("[users][list]", error);
    return NextResponse.json({ error: "Failed to load users." }, { status: 500 });
  }
}
