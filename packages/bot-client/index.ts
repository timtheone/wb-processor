import { Telegraf, Scenes, session, Context } from "telegraf";
import { createUser, getUserByTelegramId } from "./entities/User/user";
import { setupCommands } from "./commands/commands_handler";
import { shopCreationScene } from "./scenes/shopCreationScene";
import type { Update } from "telegraf/types";
import type { Shop, User } from "@prisma/client";
import { setupActions } from "./actions/actions_handler";
import { ApiClient } from "./api/apiClient";

const SESSION_TIMEOUT = 60 * 60 * 6; // 1 hour in seconds
const TOKEN_BOT = Bun.env.BOT_TOKEN;

console.log("BIG TEST", TOKEN_BOT);
console.log("Databaseurl", Bun.env.DATABASE_URL);

export const apiClient = ApiClient.getInstance();
export interface MyContext<U extends Update = Update> extends Context<U> {
  session: {
    [key: string]: {
      user?: User;
      shops?: Shop[];
      createdAt: number;
      lastAccess?: number;
    };
  };
}

if (!TOKEN_BOT) {
  console.error("BOT_TOKEN is not defined");
  process.exit(1);
}
const Bot = new Telegraf<MyContext>(TOKEN_BOT);

Bot.use(session()); // to  be precise, session is not a must have for Scenes to work, but it sure is lonely without one
// Middleware to check or create a user
Bot.use(async (ctx, next) => {
  const telegramUserId = String(ctx.from.id);
  const currentTime = Math.floor(Date.now() / 1000);

  ctx.session ??= {
    [telegramUserId]: {
      createdAt: currentTime,
    },
  };

  if (!(telegramUserId in ctx.session)) {
    ctx.session = {
      [telegramUserId]: {
        createdAt: currentTime,
      },
    };
  }

  ctx.session[telegramUserId].lastAccess = currentTime;

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

  await next();
});

Bot.use((ctx, next) => {
  const telegramUserId = String(ctx.from.id);
  const currentTime = Math.floor(Date.now() / 1000);
  if (
    ctx.session[telegramUserId].createdAt &&
    currentTime - ctx.session[telegramUserId].createdAt > SESSION_TIMEOUT
  ) {
    delete ctx.session[telegramUserId];
  } else {
    // Session is active, update lastAccess time
    ctx.session[telegramUserId].lastAccess = currentTime;
  }
  next();
});

const stage = new Scenes.Stage([shopCreationScene(Bot)]);
Bot.use(stage.middleware());

setupCommands(Bot);
setupActions(Bot);

Bot.launch();

// 438143658
