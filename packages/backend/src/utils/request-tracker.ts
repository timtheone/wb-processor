import * as fs from "fs";
import * as path from "path";

interface APIRequestLog {
  timestamp: number;
  url: string;
  method: string;
  statusCode?: number;
  responseBody?: string;
}

class WildberriesRequestTracker {
  private requestLogs: APIRequestLog[] = [];
  private readonly logFilePath: string;

  constructor() {
    // Create logs directory in monorepo root by going up 3 levels from current file
    const monoRepoRoot = path.join(process.cwd(), "..", "..");
    console.log(monoRepoRoot);
    const logsDir = path.join(monoRepoRoot, "logs");

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logFilePath = path.join(logsDir, "wildberries-requests.txt");
  }

  trackRequest(
    url: string,
    method: string,
    statusCode?: number,
    responseBody?: string
  ) {
    if (
      Bun.env.WB_API_URL_MARKETPLACE &&
      url.includes(Bun.env.WB_API_URL_MARKETPLACE)
    ) {
      const logEntry: APIRequestLog = {
        timestamp: Date.now(),
        url,
        method,
        statusCode,
        responseBody,
      };

      this.requestLogs.push(logEntry);

      // Write to file with additional info if status code is outside 200-299
      let logLine = `[${new Date(
        logEntry.timestamp
      ).toISOString()}] ${method} ${url}`;
      if (statusCode) {
        logLine += ` Status: ${statusCode}`;
        if (responseBody) {
          logLine += `\nResponse: ${responseBody}`;
        }
      }
      logLine += "\n";
      fs.appendFileSync(this.logFilePath, logLine);
    }
  }

  getLogs(): APIRequestLog[] {
    return [...this.requestLogs];
  }

  // Read logs from file
  readLogsFromFile(): string {
    try {
      return fs.readFileSync(this.logFilePath, "utf-8");
    } catch (error) {
      return "No logs found";
    }
  }
}

export const wildberriesTracker = new WildberriesRequestTracker();

// Updated trackedFetch function
export async function trackedFetch(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);

  if (response.status < 200 || response.status > 299) {
    // Clone the response to read the body, as it can only be read once
    const responseClone = response.clone();
    const responseBody = await responseClone.text();
    wildberriesTracker.trackRequest(
      url,
      options.method || "GET",
      response.status,
      responseBody
    );
  } else {
    wildberriesTracker.trackRequest(
      url,
      options.method || "GET",
      response.status
    );
  }

  return response;
}
