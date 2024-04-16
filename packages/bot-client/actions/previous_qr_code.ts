import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export function previous_qr_code(bot: Telegraf<MyContext<Update>>) {
  bot.action(/previous_qr_code_(.+)/, async (ctx) => {
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

    const response = await apiClient.getPreviousCode(existingShop?.token!);

    const imgBuffer = Buffer.from(response.file, "base64");

    await ctx.reply(
      `Ваш QR-код c предыдущий поставки для магазина ${existingShop.name}.`
    );
    await ctx.replyWithPhoto({ source: imgBuffer });
    await ctx.answerCbQuery("Предыдущий QR-код получен.");
  });
}
