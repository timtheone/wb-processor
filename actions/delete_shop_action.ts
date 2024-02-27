import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import {
  deleteShopById,
  getAllShopsFromUserFromContext,
} from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export function delete_shop_action(bot: Telegraf<MyContext<Update>>) {
  bot.action(/delete_shop_(.+)/, async (ctx) => {
    await ctx.reply(`Удаляем...`);
    const shopId = ctx.match[1];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.id === shopId);
    console.log("existingShop", existingShop);
    const session = await getSession(ctx);

    if (existingShop) {
      const deletedShop = await deleteShopById(existingShop?.id);
      console.log("deletedShop", deletedShop);

      if (deletedShop) {
        session.shops = session.shops!.filter(
          (shop) => shop.id !== deletedShop.id
        );
        const existingChatSpecificCommands = await bot.telegram.getMyCommands({
          scope: {
            type: "chat",
            chat_id: ctx.chat.id,
          },
        });

        const filteredOutShopCommands = existingChatSpecificCommands.filter(
          (shop) => {
            return shop.command !== `process_shop_${deletedShop.name}`;
          }
        );

        bot.telegram.setMyCommands(filteredOutShopCommands, {
          scope: {
            type: "chat",
            chat_id: ctx.chat.id,
          },
        });

        await ctx.reply(`Магазин ${deletedShop.name} успешно удален`);
      } else {
        await ctx.reply(`Не удалось удалить магазин ${existingShop.name}`);
      }
    }
    await ctx.answerCbQuery();
  });
}
