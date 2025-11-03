import { NextResponse } from "next/server";
import { getUserSummary } from "@/lib/storage-data";

type RouteContext = {
  params: Promise<{
    username: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username } = await context.params;

  try {
    const summary = await getUserSummary(username);
    if (!summary) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(summary);
  } catch (error) {
    console.error("[users][summary]", username, error);
    return NextResponse.json({ error: "Failed to load user info." }, { status: 500 });
  }
}
