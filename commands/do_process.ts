import type { Telegraf } from "telegraf";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";

export function do_processCommand(bot: Telegraf<MyContext<Update>>) {
  bot.command("do_process", async (ctx) => {
    const shops = await getAllShopsFromUserFromContext(ctx);

    bot.telegram.sendMessage(`${ctx.chat.id}`, "Действия магазина", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Получить со всех магазинов",
              callback_data: "wb_process_action_real_allshops",
            },
          ],
          ...shops.map((shop) => {
            return [
              {
                text: `Получить с магазина ${shop.name}`,
                callback_data: `wb_process_action_real_shop_${shop.id}`,
              },
            ];
          }),
        ],
      },
    });
  });
}
