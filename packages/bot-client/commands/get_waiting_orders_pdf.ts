import type { Telegraf } from "telegraf";
import { apiClient, type MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";
import { formatDate } from "../utils/formatDate";

export async function get_waiting_orders_pdf(bot: Telegraf<MyContext<Update>>) {
  bot.command("generate_waiting_orders_pdf", async (ctx) => {
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    const shops = await getAllShopsFromUserFromContext(ctx);
    if (shops.length === 0) {
      await ctx.reply(`У вас нет магазинов`);
      await ctx.answerCbQuery();
    }
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");

    const supplyIdsPromises = shops.map(async (shop) => {
      return apiClient
        .getLastSixSupplies(shop.token)
        .then((response) => ({
          status: "fulfilled",
          supplyIds: response.supplyIds,
          shopName: shop.name,
        }))
        .catch((error) => ({ status: "rejected", reason: error }));
    });

    const supplyIdsPromisesResults = await Promise.all(supplyIdsPromises);

    if (
      supplyIdsPromisesResults.some((result) => result.status === "rejected")
    ) {
      await ctx.reply("Не удалось получить список поставок.");
      return;
    }

    const payload = shops.map((shop) => {
      return {
        token: shop.token,
        dbname: shop.name,
        telegramId: session.user!.dbNameSpaceId!,
        supplyIds: supplyIdsPromisesResults.find(
          (result) => result.shopName === shop.name
        )?.supplyIds,
      };
    });

    const apiPayload = JSON.stringify({
      shops: payload,
    });

    const orderListPdf = await apiClient.getWaitingOrderListPdfCombinedShops(
      "order",
      apiPayload
    );

    let messageId;
    let messageId2;
    const newDate = new Date();
    await ctx
      .reply(`Генерируем лист подбора для ожидающих заказов...`)
      .then((ctx) => {
        messageId = ctx.message_id;
      });

    await ctx
      .replyWithDocument({
        source: orderListPdf,
        filename: `Лист-подбора-ожидающие_${formatDate(newDate, true)}.pdf`,
      })
      .then((ctx) => {
        bot.telegram.editMessageText(
          ctx.chat.id,
          messageId,
          undefined,
          `Ваш лист подбора для ожидающих заказов:`
        );
      });

    await ctx
      .reply(`Генерируем лист со стикерами для ожидающих заказов...`)
      .then((ctx) => {
        messageId2 = ctx.message_id;
      });

    const stickersListPdf = await apiClient.getWaitingOrderListPdfCombinedShops(
      "stickers",
      apiPayload
    );

    await ctx
      .replyWithDocument({
        source: stickersListPdf,
        filename: `Стикеры-ожидающие_${formatDate(newDate, true)}.pdf`,
      })
      .then((ctx) => {
        bot.telegram.editMessageText(
          ctx.chat.id,
          messageId2,
          undefined,
          `Ваш лист со стикерами для ожидающих заказов:`
        );
      });
  });
}
