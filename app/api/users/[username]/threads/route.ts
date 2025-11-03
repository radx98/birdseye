import { NextResponse } from "next/server";
import { getUserThreads } from "@/lib/modal-data";

type RouteContext = {
  params: Promise<{
    username: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username } = await context.params;

  try {
    const threads = await getUserThreads(username);
    if (threads === null) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(threads);
  } catch (error) {
    console.error("[users][threads]", username, error);
    return NextResponse.json({ error: "Failed to load threads." }, { status: 500 });
  }
}
