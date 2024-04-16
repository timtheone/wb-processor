import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { shopCreationSceneId } from "../scenes/shopCreationScene";
import { getSession } from "../utils/getSession";

export function add_shop_index_Action(bot: Telegraf<MyContext<Update>>) {
  bot.action("add_shop", async (ctx) => {
    const session = await getSession(ctx);

    if (!session.user) {
      await ctx.reply("Пользователь не найден.");
      return;
    }
    ctx.scene.enter(shopCreationSceneId);
  });
}
