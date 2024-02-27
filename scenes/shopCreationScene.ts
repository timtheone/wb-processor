import { Scenes, Telegraf } from "telegraf";
import {
  createShop,
  getAllShopsFromUserFromContext,
  getShopByNameFromUser,
} from "../entities/Shop/shop";
import { getSession } from "../utils/getSession";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
export const shopCreationSceneId = "SHOP_CREATION";

export const shopCreationScene = (bot: Telegraf<MyContext<Update>>) => {
  return new Scenes.WizardScene(
    shopCreationSceneId,
    (ctx) => {
      ctx.reply(
        "Введите название магазина (только латинские буквы цифры, без пробело, дефис допустим)"
      );
      ctx.wizard.state.shop = {};
      return ctx.wizard.next();
    },
    async (ctx) => {
      const session = await getSession(ctx);
      const user = session.user;

      console.log("ctx.chat.id", ctx.chat.id);

      const existingShop = await getShopByNameFromUser(
        user.id,
        ctx.message.text
      );
      if (existingShop) {
        await ctx.reply(
          `Магазин с названием <b>"${ctx.message.text}"</b> уже существует. Попробуйте другое название.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      const validNameRegex = /^[a-zA-Z0-9\-\+]+$/;

      if (!validNameRegex.test(ctx.message.text)) {
        // If shop name doesn't match the pattern, ask for it again
        await ctx.reply(
          "Название магазина содержит недопустимые символы. Попробуйте ещё раз."
        );
        return;
      }

      ctx.wizard.state.shop.name = ctx.message.text;
      ctx.reply("Введите токен для Вайлдберриз АПИ вашего магазина");
      return ctx.wizard.next();
    },
    async (ctx) => {
      const session = await getSession(ctx);
      const user = session.user;
      ctx.wizard.state.shop.token = ctx.message.text;
      const shopCreated = await createShop({
        name: ctx.wizard.state.shop.name,
        token: ctx.wizard.state.shop.token,
        userId: user.id,
      });
      if (shopCreated) {
        const freshShops = await getAllShopsFromUserFromContext(ctx);
        session.shops = [...freshShops, shopCreated];
        const existingChatSpecificCommands = await bot.telegram.getMyCommands({
          scope: {
            type: "chat",
            chat_id: ctx.chat.id,
          },
        });

        const doesProccessAllShopsCommandExists =
          existingChatSpecificCommands.find((command) => {
            if (command.command === `process_all_shops`) {
              return true;
            }
            return false;
          });

        const newShopCommand = {
          command: `process_shop_${shopCreated.name}`,
          description: `Обработать заказы для магазина ${shopCreated.name}`,
        };

        doesProccessAllShopsCommandExists
          ? bot.telegram.setMyCommands(
              [...existingChatSpecificCommands, newShopCommand],
              {
                scope: {
                  type: "chat",
                  chat_id: ctx.chat.id,
                },
              }
            )
          : bot.telegram.setMyCommands(
              [
                ...existingChatSpecificCommands,
                newShopCommand,
                {
                  command: `process_all_shops`,
                  description: `Обработать заказы для всех магазинов`,
                },
              ],
              {
                scope: {
                  type: "chat",
                  chat_id: ctx.chat.id,
                },
              }
            );

        await ctx.reply(
          `Магазин <b>"${shopCreated.name}"</b> добавлен успешно!`,
          { parse_mode: "HTML" }
        );
      } else {
        ctx.reply(`Произошла ошибка. Магазин не был добавлен!`);
      }
      return ctx.scene.leave();
    }
  );
};
