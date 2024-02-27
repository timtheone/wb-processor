import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";

export function shopCommand(bot: Telegraf<MyContext<Update>>) {
  bot.command("shop", async (ctx) => {
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
