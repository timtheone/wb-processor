import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";

export function list_shop_Action(bot: Telegraf<MyContext<Update>>) {
  bot.action("list_shop", async (ctx) => {
    const shops = await getAllShopsFromUserFromContext(ctx);
    // Generate a message listing all shops
    const shopList = Object.values(shops)
      .map((shop, index) => `${index + 1}. ${shop.name}`)
      .join("\n");

    const message = shopList.length
      ? `Список магазинов:\n${shopList}`
      : "Магазины не найдены.";

    if (shopList.length) {
      bot.telegram.sendMessage(`${ctx.chat.id}`, "Выбрать магазин", {
        reply_markup: {
          inline_keyboard: [
            shops.map((shop) => {
              return {
                text: shop.name! as string,
                callback_data: `select_shop_${shop.id}`,
              };
            }),
          ],
        },
      });
    }

    await ctx.answerCbQuery();
    await ctx.reply(message);
  });
}
