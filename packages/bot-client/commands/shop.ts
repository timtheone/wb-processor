import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getSession } from "../utils/getSession";

export function shopCommand(bot: Telegraf<MyContext<Update>>) {
  bot.command("shop", async (ctx) => {
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    bot.telegram.sendMessage(`${ctx.chat.id}`, "Действия магазина", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Список магазинов",
              callback_data: "list_shop",
            },
            {
              text: "Cоздать магазин",
              callback_data: "add_shop",
            },
          ],
        ],
      },
    });
  });
}
