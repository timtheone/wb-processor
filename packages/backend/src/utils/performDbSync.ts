import { sql } from "drizzle-orm";
import { createOrOpenDatabase } from "../../db/createDb";
import { productCards, shopToken } from "../../db/schema";

const getProductCards = async ({
  token,
  limit,
  updatedAt,
  nmID,
}: {
  token: string;
  limit: number;
  updatedAt?: string;
  nmID?: number;
}) => {
  const buildBody = () => {
    const body = {
      settings: {
        cursor: {
          limit,
        },
        filter: {
          withPhoto: 1,
        },
      },
    };

    // Note: Updated to cursor for both updatedAt and nmID as per your latest code
    if (updatedAt) {
      body.settings.cursor.updatedAt = updatedAt;
    }

    if (nmID) {
      body.settings.cursor.nmID = nmID;
    }

    return body;
  };

  const response = await fetch(
    `${Bun.env.WB_API_URL_CONTENT}/content/v2/get/cards/list`,
    {
      headers: {
        Authorization: token,
      },
      method: "POST",
      body: JSON.stringify(buildBody()),
    }
  ).then((data) => data.json());

  // Initialize completeData with response.cards or an empty array if it's undefined
  let completeData = response.cards || [];

  if (response.cards && response.cards.length === limit) {
    // Make a recursive call if the condition is met
    const response2 = await getProductCards({
      token,
      limit,
      updatedAt: response.cursor ? response.cursor.updatedAt : undefined,
      nmID: response.cursor ? response.cursor.nmID : undefined,
    });

    // Ensure response2 is an array before concatenating
    if (Array.isArray(response2) && response2.length > 0) {
      completeData = completeData.concat(response2);
    }
  }

  return completeData;
};

export async function performDbSync(
  dbName: string,
  telegramId: string,
  token?: string
) {
  try {
    console.log(`performDbSync started for ${dbName} ...`);
    const db = await createOrOpenDatabase(dbName, telegramId);
    let innerTokenValue: string;

    if (token) {
      innerTokenValue = token;
      const tokenTest = await db
        .select({ token: shopToken.token })
        .from(shopToken);

      if (tokenTest.length === 0) {
        await db
          .insert(shopToken)
          .values({ token: token })
          .returning({ insertedId: shopToken.token });
      }
    } else {
      const tokenTest = await db
        .select({ token: shopToken.token })
        .from(shopToken);

      if (tokenTest.length === 0 || !tokenTest[0].token) {
        throw new Error("Token not found in db");
      }
      innerTokenValue = tokenTest[0].token;
    }

    const cards = await getProductCards({
      token: innerTokenValue,
      limit: 100,
    });

    const transformedData = cards.map((card) => {
      return {
        id: card.nmID,
        vendorCode: card.vendorCode,
        brand: card.brand,
        title: card.title,
        img: card.photos[0].c246x328,
        ageGroup: card.characteristics?.find((characteristic) => {
          return characteristic.id === 73245;
        })?.value[0],
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      };
    });

    const dbInsertResponse = await db
      .insert(productCards)
      .values(transformedData)
      .onConflictDoUpdate({
        target: productCards.id,
        set: {
          vendorCode: sql`EXCLUDED.vendorCode`,
          brand: sql`EXCLUDED.brand`,
          title: sql`EXCLUDED.title`,
          img: sql`EXCLUDED.img`,
          ageGroup: sql`EXCLUDED.ageGroup`,
          updatedAt: sql`EXCLUDED.updatedAt`,
          createdAt: sql`EXCLUDED.createdAt`,
        },
        where: sql`productCards.updatedAt < EXCLUDED.updatedAt`,
      })
      .returning({ insertedId: productCards.id });
    console.log("performDbSync finished...", dbInsertResponse?.length);
    return dbInsertResponse;
  } catch (error) {
    console.error("Error syncing db:", error);
    throw new Error("Failed to sync db");
  }
}
