import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export async function process_all_shops(bot: Telegraf<MyContext<Update>>) {
  bot.command("process_all_shops", async (ctx) => {
    const shops = await getAllShopsFromUserFromContext(ctx);
    if (shops.length === 0) {
      await ctx.reply(`У вас нет магазинов`);
      await ctx.answerCbQuery();
    }
    const session = await getSession(ctx);
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");

    const fetchPromises = shops.map((shop) => {
      return apiClient
        .processOrders(shop.token)
        .then((response) => ({
          status: "fulfilled",
          file: response.file,
          shopName: shop.name,
          supplyId: response.barcode,
        }))
        .catch((error) => ({ status: "rejected", reason: error }));
    });

    // Wait for all fetch promises to settle
    const results = await Promise.allSettled(fetchPromises);

    const orderListPromises = shops.map((shop) => {
      return apiClient
        .getOrderListPdf({
          token: shop.token,
          dbname: shop.name,
          telegramId: session.user!.telegramUserId!,
          supplyId: results.find(
            (result) => result.value.shopName === shop.name
          )?.value?.supplyId,
        })
        .then((response) => ({
          status: "fulfilled",
          file: response,
        }))
        .catch((error) => ({ status: "rejected", reason: error }));
    });
    const orderListResults = await Promise.allSettled(orderListPromises);

    // Process results
    // Process results in the original order
    for (let i = 0; i < shops.length; i++) {
      const result = results[i] as {
        status: string;
        value?: { shopName: string; file: string; supplyId: string };
      };

      const orderListResult = orderListResults[i] as {
        status: string;
        value?: { file: string };
      };

      if (
        result.status === "fulfilled" &&
        result.value &&
        result.value.file &&
        orderListResult.status === "fulfilled" &&
        orderListResult.value &&
        orderListResult.value.file
      ) {
        // Success: Send the shop name and the photo

        await ctx.reply(`Ваш QR код для магазина ${result.value.shopName}:`);
        const imgBuffer = Buffer.from(result.value.file, "base64");
        await ctx.replyWithPhoto({ source: imgBuffer });
        let messageId;
        await ctx
          .reply(`Генерируем лист подбора для ${result.value.shopName}...`)
          .then((ctx) => {
            messageId = ctx.message_id;
          });

        await ctx
          .replyWithDocument({
            source: orderListResult.value.file,
            filename: `${
              result.value.shopName
            }_Order_list_${new Date().toISOString()}.pdf`,
          })
          .then((ctx) => {
            bot.telegram.editMessageText(
              ctx.chat.id,
              messageId,
              undefined,
              `Ваш лист подбора для магазина ${result.value.shopName}:`
            );
          });
      } else if (
        result.status === "rejected" ||
        !result?.value?.file ||
        !orderListResult?.value?.file
      ) {
        // Failure: Notify about the failure
        await ctx.reply(
          `Не удалось обработать магазин ${result?.value?.shopName}.`
        );
      }
    }
  });
}
