import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";

export async function getQrCodesForAllShops(bot: Telegraf<MyContext<Update>>) {
  bot.command("allshops_prev_qrcodes", async (ctx) => {
    const shops = await getAllShopsFromUserFromContext(ctx);
    if (shops.length === 0) {
      await ctx.reply(`У вас нет магазинов`);
      await ctx.answerCbQuery();
    }
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");

    const fetchPromises = shops.map((shop) => {
      return apiClient
        .getPreviousCode(shop.token)
        .then((response) => ({
          status: "fulfilled",
          file: response.file,
          shopName: shop.name,
        }))
        .catch((error) => ({ status: "rejected", reason: error }));
    });

    // Wait for all fetch promises to settle
    const results = await Promise.allSettled(fetchPromises);

    // Process results
    // Process results in the original order
    for (let i = 0; i < shops.length; i++) {
      const result = results[i] as {
        status: string;
        value?: { shopName: string; file: string };
      };
      if (result.status === "fulfilled" && result.value && result.value.file) {
        // Success: Send the shop name and the photo
        await ctx.reply(
          `Ваш предыдущий QR код для магазина ${result.value.shopName}:`
        );
        const imgBuffer = Buffer.from(result.value.file, "base64");
        await ctx.replyWithPhoto({ source: imgBuffer });
      } else if (result.status === "rejected" || !result?.value?.file) {
        // Failure: Notify about the failure
        await ctx.reply(
          `Не удалось обработать магазин ${result?.value?.shopName}.`
        );
      }
    }
  });
}