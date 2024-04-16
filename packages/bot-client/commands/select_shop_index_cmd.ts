import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export function process_shop_cmd(bot: Telegraf<MyContext<Update>>) {
  bot.command(/process_shop_(.+)/, async (ctx) => {
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    const shopName = ctx.command.split("_")[2];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.name === shopName);

    bot.telegram.sendMessage(
      `${ctx.chat.id}`,
      `Действия магазина ${shopName}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Обработать заказ",
                callback_data: `wb_process_action_real_shop_${existingShop.id}`,
              },
              {
                text: "Получить предыдущий QR-код",
                callback_data: `previous_qr_code_${existingShop.id}`,
              },
            ],
          ],
        },
      }
    );
  });
}
