class RequestTracker {
  private requests: number[] = [];
  private readonly windowMs = 60000; // 1 minute in milliseconds

  trackRequest(timestamp = Date.now()) {
    this.requests.push(timestamp);
    this.cleanup(timestamp);
  }

  getRequestsInWindow(timestamp = Date.now()): number {
    this.cleanup(timestamp);
    return this.requests.length;
  }

  private cleanup(now: number) {
    const windowStart = now - this.windowMs;
    this.requests = this.requests.filter((time) => time > windowStart);
  }
}

export const marketplaceTracker = new RequestTracker();
