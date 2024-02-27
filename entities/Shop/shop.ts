import type { MyContext } from "../..";
import prisma from "../../prisma/prisma-client";
import { getSession } from "../../utils/getSession";

export async function createShop({
  name,
  token,
  userId,
}: {
  name: string;
  token: string;
  userId: string;
}) {
  console.log("ran a query createShop");
  // First, check if a shop with the given name and userId already exists
  const existingShop = await prisma.shop.findFirst({
    where: {
      name: name,
      user: {
        id: userId,
      },
    },
  });

  // If a shop exists, throw an error
  if (existingShop) {
    throw new Error(
      `A shop with the name "${name}" already exists for this user.`
    );
  }

  const shop = await prisma.shop.create({
    data: {
      name: name,
      token: token,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });

  return shop;
}

export async function getShopByNameFromUser(userId: string, name: string) {
  console.log("ran a query getShopByNameFromUser");
  const shop = await prisma.shop.findFirst({
    where: {
      name: name,
      user: {
        id: userId,
      },
    },
  });

  if (shop) {
    return shop;
  } else {
    return null;
  }
}

export async function getAllShopsFromUser(userId: string) {
  console.log("ran a query getAllShopsFromUser");
  const shops = await prisma.shop.findMany({
    where: {
      userId: userId,
    },
  });

  return shops;
}

export async function getAllShopsFromUserFromContext(ctx: MyContext) {
  const session = await getSession(ctx);

  if (!session.shops) {
    const shops = await getAllShopsFromUser(session!.user!.id);
    session.shops = shops;
    return shops;
  }
  return session.shops;
}

export async function getShopById(shopId: string) {
  console.log("ran a query getShopById");
  const shop = await prisma.shop.findFirst({
    where: {
      id: shopId,
    },
  });

  if (shop) {
    return shop;
  } else {
    return null;
  }
}

export async function deleteShopById(shopId: string) {
  console.log("ran a query deleteShopById");
  const shop = await prisma.shop.delete({
    where: {
      id: shopId,
    },
  });

  return shop;
}
