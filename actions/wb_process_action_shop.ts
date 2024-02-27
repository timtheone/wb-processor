import type { Telegraf } from "telegraf";
import type { MyContext } from "..";
import type { Update } from "telegraf/types";

export function wb_process_action_shop_Action(
  bot: Telegraf<MyContext<Update>>
) {
  bot.action("wb_process_action_shop", async (ctx) => {
    await ctx.reply(`Работаем...`);
    await ctx.telegram.sendChatAction(ctx.chat?.id, "typing");
    const response = (await fetch("http://localhost:3000/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((res) => res.json())) as { file: string };

    const imgBuffer = Buffer.from(response.file, "base64");

    ctx.replyWithPhoto({ source: imgBuffer });
  });
}
