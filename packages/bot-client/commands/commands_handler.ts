import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { shopCommand } from "./shop";
import { startCommand } from "./start";
import { process_shop_cmd } from "./select_shop_index_cmd";
import { process_all_shops } from "./process_all_shops";
import { quick_action } from "./quick_action";
import { getQrCodesForAllShops } from "./get_previous_qr_codes_for_all_shops";
import { sync_content_shops } from "./sync_content_db";
import { get_combined_pdf_lists } from "./get_combined_pdf_lists";
import { get_single_supply_pdf } from "./get_single_supply_pdf";
import { get_waiting_orders_pdf } from "./get_waiting_orders_pdf";

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
    getQrCodesForAllShops,
    sync_content_shops,
    get_combined_pdf_lists,
    get_single_supply_pdf,
    get_waiting_orders_pdf,
  ]);
};
