import prisma from "../../prisma/prisma-client";

export async function createUser({
  username,
  telegramUserId,
}: {
  username: string;
  telegramUserId: string;
}) {
  console.log("ran a query createUser");
  // First, check if a user with the given chatId and telegramUserId already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      telegramUserId: telegramUserId,
    },
  });

  // If a shop exists, throw an error
  if (existingUser) {
    throw new Error(`A user with "${telegramUserId}" id already exists.`);
  }

  const user = await prisma.user.create({
    data: {
      username: username,
      telegramUserId: telegramUserId,
    },
  });

  return user;
}

export async function getUserByTelegramId(telegramUserId: string) {
  console.log("ran a query getUserByTelegramId");
  try {
    const user = await prisma.user.findFirst({
      where: {
        telegramUserId: telegramUserId,
      },
    });

    if (user) {
      return user;
    } else {
      return null;
    }
  } catch (error) {
    throw new Error(`Error fetching user: ${error}`);
  }
}
