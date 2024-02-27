import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";

export async function process_all_shops(bot: Telegraf<MyContext<Update>>) {
  bot.command("process_all_shops", async (ctx) => {
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");
    const shops = await getAllShopsFromUserFromContext(ctx);

    // Map each shop to a fetch promise
    const fetchPromises = shops.map((shop) =>
      fetch("http://localhost:3000/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: shop.token }), // Assuming each shop has a token
      })
        .then((res) => res.json())
        .then((response) => ({
          status: "fulfilled",
          value: response.file,
          shopName: shop.name,
        }))
        .catch((error) => ({ status: "rejected", reason: error }))
    );

    // Wait for all fetch promises to settle
    const results = await Promise.allSettled(fetchPromises);

    // Process results
    // Process results in the original order
    for (let i = 0; i < shops.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled" && result.value && result.value.value) {
        // Success: Send the shop name and the photo
        await ctx.reply(`Ваш QR код для магазина ${result.value.shopName}:`);
        const imgBuffer = Buffer.from(result.value.value, "base64");
        await ctx.replyWithPhoto({ source: imgBuffer });
      } else if (result.status === "rejected" || !result.value.value) {
        // Failure: Notify about the failure
        await ctx.reply(
          `Не удалось обработать магазин ${result.value.shopName}.`
        );
      }
    }
  });
}
