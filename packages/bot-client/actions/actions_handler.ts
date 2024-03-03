import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";
import { select_shop_Action } from "./select_shop_action";
import { list_shop_Action } from "./list_shop";
import { add_shop_index_Action } from "./add_shop_index";
import { wb_process_action_real_shop_index_Action } from "./wb_process_action_real_shop_index";
import { previous_qr_code } from "./previous_qr_code";
import { delete_shop_action } from "./delete_shop_action";

export const attachActions = (
  bot: Telegraf<MyContext<Update>>,
  actions: Array<(bot: Telegraf<MyContext<Update>>) => void>
) => {
  actions.forEach((setupAction) => {
    setupAction(bot);
  });
};

export const setupActions = (Bot: Telegraf<MyContext<Update>>) => {
  attachActions(Bot, [
    select_shop_Action,
    list_shop_Action,
    add_shop_index_Action,
    wb_process_action_real_shop_index_Action,
    previous_qr_code,
    delete_shop_action,
  ]);
};
