import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";

export function get_previous_shop_qr(bot: Telegraf<MyContext<Update>>) {
  bot.command(/get_previous_supply_qr_(.+)/, async (ctx) => {
    const shopName = ctx.command.split("_")[4];
    const shops = await getAllShopsFromUserFromContext(ctx);
    const existingShop = shops.find((shop) => shop.name === shopName);

    const response = (await fetch("http://localhost:3000/get_previous_code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: existingShop?.token }),
    }).then((res) => res.json())) as { file: string };

    const imgBuffer = Buffer.from(response.file, "base64");

    await ctx.reply(
      `Ваш QR-код c предыдущий поставки для магазина ${existingShop.name}.`
    );
    await ctx.replyWithPhoto({ source: imgBuffer });
  });
}
