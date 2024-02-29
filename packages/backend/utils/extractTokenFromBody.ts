import { HonoRequest } from "hono";
import { HTTPException } from "hono/http-exception";

export async function extractTokenFromBody(req: HonoRequest) {
  try {
    const body = await req.json();
    if (!("token" in body)) {
      throw new Error("no_token");
    }
    return body.token;
  } catch (error) {
    if (error instanceof Error && error.message === "no_token") {
      throw new HTTPException(400, {
        message: "Invalid request body, missing token",
      });
    }
    throw new HTTPException(400, { message: "Invalid request body" });
  }
}
