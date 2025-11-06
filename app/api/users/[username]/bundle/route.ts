import { NextResponse } from "next/server";
import { getUserDataBundle } from "@/lib/storage-data";

type RouteContext = {
  params: Promise<{
    username: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { username } = await context.params;

  try {
    const bundle = await getUserDataBundle(username);
    if (!bundle) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    return NextResponse.json(bundle);
  } catch (error) {
    console.error("[users][bundle]", username, error);
    return NextResponse.json({ error: "Failed to load user data." }, { status: 500 });
  }
}
