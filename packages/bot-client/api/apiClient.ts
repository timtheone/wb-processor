import { getLastSupply, getMock, processOrders } from "./functions";

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
      return await processOrders(token);

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
      return await getLastSupply(token);
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
