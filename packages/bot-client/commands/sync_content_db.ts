import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export async function sync_content_shops(bot: Telegraf<MyContext<Update>>) {
  bot.command("sync_content_shops", async (ctx) => {
    const shops = await getAllShopsFromUserFromContext(ctx);
    const session = await getSession(ctx);
    if (shops.length === 0) {
      await ctx.reply(`У вас нет магазинов`);
      await ctx.answerCbQuery();
    }
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");

    const fetchPromises = shops.map((shop) => {
      return apiClient
        .syncDb(shop.token, shop.name, session.user!.telegramUserId!)
        .then((response) => ({
          status: "fulfilled",
          value: response,
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
        value?: { shopName: string; value: string };
      };

      if (result.status === "fulfilled" && result.value && result.value.value) {
        await ctx.reply(
          `${result.value.value} для магазина ${result.value.shopName}.`
        );
      } else if (result.status === "rejected" || !result?.value?.value) {
        // Failure: Notify about the failure
        await ctx.reply(
          `Не удалось cинхронизировать магазин ${result?.value?.shopName}.`
        );
      }
    }
  });
}
