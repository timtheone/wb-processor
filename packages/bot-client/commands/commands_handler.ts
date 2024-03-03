import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { shopCommand } from "./shop";
import { startCommand } from "./start";
import { process_shop_cmd } from "./select_shop_index_cmd";
import { process_all_shops } from "./process_all_shops";
import { quick_action } from "./quick_action";

export const attachCommands = (
  bot: Telegraf<MyContext<Update>>,
  commands: Array<(bot: Telegraf<MyContext<Update>>) => void>
) => {
  commands.forEach((setupCommand) => {
    setupCommand(bot);
  });
};

export const setupCommands = (Bot: Telegraf<MyContext<Update>>) => {
  attachCommands(Bot, [
    startCommand,
    shopCommand,
    process_shop_cmd,
    process_all_shops,
    quick_action,
  ]);
};
