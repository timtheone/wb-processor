import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { shopCreationSceneId } from "../scenes/shopCreationScene";

export function add_shop_index_Action(bot: Telegraf<MyContext<Update>>) {
  bot.action("add_shop", async (ctx) => {
    ctx.scene.enter(shopCreationSceneId);
  });
}
