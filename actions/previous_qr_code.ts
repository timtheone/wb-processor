import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";

export function previous_qr_code(bot: Telegraf<MyContext<Update>>) {
  bot.action(/previous_qr_code_(.+)/, async (ctx) => {
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");
    const shopId = ctx.match[1];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.id === shopId);

    const response = await apiClient.getPreviousCode(existingShop?.token!);

    const imgBuffer = Buffer.from(response.file, "base64");

    await ctx.reply(
      `Ваш QR-код c предыдущий поставки для магазина ${existingShop.name}.`
    );
    await ctx.replyWithPhoto({ source: imgBuffer });
    await ctx.answerCbQuery("Предыдущий QR-код получен.");
  });
}
