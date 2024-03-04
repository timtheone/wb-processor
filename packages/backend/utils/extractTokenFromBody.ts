import { HonoRequest } from "hono";
import { HTTPException } from "hono/http-exception";

export async function extractFromBody(req: HonoRequest, key: string) {
  try {
    const body = await req.json();
    if (!(key in body)) {
      throw new Error(`no ${key} found in body`);
    }
    return body[key];
  } catch (error) {
    if (error instanceof Error && error.message === `no ${key} found in body`) {
      throw new HTTPException(400, {
        message: `Invalid request body, missing ${key}`,
      });
    }
    throw new HTTPException(400, { message: "Invalid request body" });
  }
}
