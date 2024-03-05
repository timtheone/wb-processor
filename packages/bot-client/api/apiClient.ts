import { getLastSupplyQrCode, getMock, processOrdersReal } from "./functions";

export class ApiClient {
  private static instance: ApiClient;
  private apiUrl: string;

  private constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      const apiUrl = Bun.env.WB_PROCESSOR_API_URL;
      if (!apiUrl) {
        throw new Error("WB_PROCESSOR_API_URL is not defined");
      }
      ApiClient.instance = new ApiClient(apiUrl);
    }
    return ApiClient.instance;
  }

  private async fetchWithTimeout(
    resource: string,
    options: RequestInit & { timeout?: number }
  ) {
    const { timeout = 10000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(resource, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      console.error("Error fetching resource:", error);
      throw new Error("Network request failed");
    }
  }

  async getOrderListPdf({
    token,
    dbname,
    telegramId,
    supplyId,
  }: {
    token: string;
    dbname: string;
    telegramId: string;
    supplyId: string;
  }): Promise<any> {
    const response = await this.fetchWithTimeout(
      `${this.apiUrl}/get-order-list-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/pdf",
        },
        body: JSON.stringify({
          token,
          dbname,
          telegramId,
          supplyId,
        }),
        timeout: 10000, // 10 Seconds timeout
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get order list pdf");
    }

    const arrayBuffer = await response.arrayBuffer();

    const readable = Buffer.from(arrayBuffer);

    return readable;
  }

  async syncDb(
    token: string,
    dbname: string,
    telegramId: string
  ): Promise<any> {
    try {
      const response = await this.fetchWithTimeout(`${this.apiUrl}/syncDB`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          dbname,
          telegramId,
        }),
        timeout: 10000, // 10 Seconds timeout
      });

      if (!response.ok) {
        throw new Error("Failed to sync db");
      }

      return await response.json();
    } catch (error) {
      console.error("Error syncing db:", error);
      throw error;
    }
  }

  async processOrders(token: string): Promise<any> {
    try {
      // const response = await this.fetchWithTimeout(
      //   `${this.apiUrl}/process-orders`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({ token }),
      //     timeout: 10000, // 10 Seconds timeout
      //   }
      // );
      // return await processOrdersReal(token);
      return await getMock(token);

      // if (!response.ok) {
      //   throw new Error("Failed to process orders");
      // }

      // return await response.json();
    } catch (error) {
      console.error("Error processing orders:", error);
      throw error;
    }
  }

  async getPreviousCode(token: string): Promise<any> {
    try {
      console.log("getPreviousCode triggered");
      // const response = await this.fetchWithTimeout(
      //   `${this.apiUrl}/get_previous_code`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({ token }),
      //     timeout: 10000, // 10 Seconds timeout
      //   }
      // );
      return await getLastSupplyQrCode(token);
      // if (!response.ok) {
      //   throw new Error("Failed to get previous code");
      // }

      // return await response.json();
    } catch (error) {
      console.error("Error getting previous code:", error);
      throw error;
    }
  }
}
