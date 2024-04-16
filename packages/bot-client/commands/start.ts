import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getSession } from "../utils/getSession";

export function startCommand(bot: Telegraf<MyContext<Update>>) {
  bot.command("start", async (ctx) => {
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    await ctx.reply(
      `Wb-processor Бот приветсвтует, вас: ${session.user?.username}!`
    );
  });
}
