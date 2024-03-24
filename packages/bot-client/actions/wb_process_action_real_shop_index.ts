import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { formatDate } from "../utils/formatDate";

export function wb_process_action_real_shop_index_Action(
  bot: Telegraf<MyContext<Update>>
) {
  bot.action(/wb_process_action_real_shop_(.+)/, async (ctx) => {
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");
    const shopId = ctx.match[1];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.id === shopId);

    const test = formatDate(new Date());
    console.log("DATE", test);
    // const response = await apiClient.processOrders(existingShop?.token!);

    // const imgBuffer = Buffer.from(response.file, "base64");

    // await ctx.reply(`Ваш QR код для магазина ${existingShop.name}:`);
    // await ctx.replyWithPhoto({ source: imgBuffer });
    // await ctx.answerCbQuery("QR-код получен.");
  });
}
