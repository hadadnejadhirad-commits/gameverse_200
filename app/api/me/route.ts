import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  return Response.json(
    user
      ? { signedIn: true, displayName: user.displayName }
      : { signedIn: false },
  );
}
