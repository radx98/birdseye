import { NextResponse } from "next/server";
import { getUserClusters } from "@/lib/storage-data";

type RouteContext = {
  params: Promise<{
    username: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username } = await context.params;

  try {
    const clusters = await getUserClusters(username);
    if (clusters === null) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(clusters);
  } catch (error) {
    console.error("[users][clusters]", username, error);
    return NextResponse.json({ error: "Failed to load clusters." }, { status: 500 });
  }
}
