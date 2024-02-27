import type { Context } from "telegraf";
import type { Update } from "telegraf/types";
import type { MyContext } from "..";
import { createUser, getUserByTelegramId } from "../entities/User/user";

function setSession(ctx: MyContext, telegramUserId: string) {
  if (!(telegramUserId in ctx.session)) {
    const currentTime = Math.floor(Date.now() / 1000);
    ctx.session = {
      ...ctx.session,
      [telegramUserId]: {
        createdAt: currentTime,
      },
    };
  }
}

export async function getSession(ctx: MyContext) {
  const telegramUserId = String(ctx?.from?.id);
  setSession(ctx, telegramUserId);

  if (!("user" in ctx.session[telegramUserId])) {
    let internalUser = await getUserByTelegramId(telegramUserId);

    if (!internalUser) {
      internalUser = await createUser({
        chatId: ctx.chat.id,
        username: ctx.from.username || "unknown",
        telegramUserId: telegramUserId,
      });
    }
    ctx.session[telegramUserId] = {
      ...ctx.session[telegramUserId],
      user: internalUser,
    };
  }

  return ctx.session[telegramUserId];
}
