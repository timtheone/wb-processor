import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export function select_shop_Action(bot: Telegraf<MyContext<Update>>) {
  bot.action(/select_shop_(.+)/, async (ctx) => {
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    const shopId = ctx.match[1];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.id === shopId);

    await ctx.reply(`Выбран магазин: ${existingShop?.name}`);

    bot.telegram.sendMessage(`${ctx.chat.id}`, "Выбрать действие", {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Удалить магазин",
              callback_data: `delete_shop_${existingShop?.id}`,
            },
            {
              text: "Обработать заказы",
              callback_data: `wb_process_action_real_shop_${existingShop?.id}`,
            },
          ],
        ],
      },
    });
  });
}
