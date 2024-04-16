import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export function wb_process_action_real_shop_index_Action(
  bot: Telegraf<MyContext<Update>>
) {
  bot.action(/wb_process_action_real_shop_(.+)/, async (ctx) => {
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");
    const shopId = ctx.match[1];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.id === shopId);

    const response = await apiClient.processOrders(existingShop?.token!);

    const imgBuffer = Buffer.from(response.file, "base64");

    await ctx.reply(`Ваш QR код для магазина ${existingShop.name}:`);
    await ctx.replyWithPhoto({ source: imgBuffer });
    await ctx.answerCbQuery("QR-код получен.");
  });
}
