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
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    await ctx.reply(`Удаляем...`);
    const shopId = ctx.match[1];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.id === shopId);

    if (existingShop) {
      const deletedShop = await deleteShopById(existingShop?.id);

      if (deletedShop) {
        await ctx.reply(`Магазин ${deletedShop.name} успешно удален`);
      } else {
        await ctx.reply(`Не удалось удалить магазин ${existingShop.name}`);
      }
    }
    await ctx.answerCbQuery();
  });
}
