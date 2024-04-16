import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { getAllShopsFromUserFromContext } from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";

export function quick_action(bot: Telegraf<MyContext<Update>>) {
  bot.command("quick_action", async (ctx) => {
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

    const commands = shops.map((shop) => {
      return [
        {
          text: `${shop.name}`,
          callback_data: `wb_process_action_real_shop_${shop.id}`,
        },
      ];
    });

    const commands2 = shops.map((shop) => {
      return [
        {
          text: `${shop.name}`,
          callback_data: `previous_qr_code_${shop.id}`,
        },
      ];
    });

    bot.telegram.sendMessage(
      `${ctx.chat.id}`,
      `Обработать заказы для магазина:`,
      {
        reply_markup: {
          inline_keyboard: commands,
          resize_keyboard: true,
        },
      }
    );

    bot.telegram.sendMessage(`${ctx.chat.id}`, `Получить предыдущий qr-код`, {
      reply_markup: {
        inline_keyboard: commands2,
        resize_keyboard: true,
      },
    });
  });
}
