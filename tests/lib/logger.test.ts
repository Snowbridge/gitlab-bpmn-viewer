import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger } from "@/lib/logger";
import type { BaseConfig } from "@/lib/configuration";

describe("Logger", () => {
  let mockConfig: { load: ReturnType<typeof vi.fn>; isDebugEnabled: ReturnType<typeof vi.fn>; isDebugStackIncluded: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    mockConfig = {
      load: vi.fn().mockResolvedValue(undefined),
      isDebugEnabled: vi.fn().mockReturnValue(false),
      isDebugStackIncluded: vi.fn().mockReturnValue(false),
    };
  });

  it("does not call console.log when debug is disabled", async () => {
    const logger = new Logger(mockConfig as unknown as BaseConfig);
    await logger.debug("test message");
    expect(console.log).not.toHaveBeenCalled();
  });

  it("calls console.log when debug is enabled", async () => {
    mockConfig.isDebugEnabled.mockReturnValue(true);
    const logger = new Logger(mockConfig as unknown as BaseConfig);
    await logger.debug("hello");
    expect(console.log).toHaveBeenCalledWith(
      expect.stringMatching(/\[gl-bpmn-viewer@.*\] hello/)
    );
  });

  it("includes optional data in log when debug enabled", async () => {
    mockConfig.isDebugEnabled.mockReturnValue(true);
    const logger = new Logger(mockConfig as unknown as BaseConfig);
    await logger.debug("msg", 1, "two");
    expect(console.log).toHaveBeenCalledWith(
      expect.any(String),
      1,
      "two"
    );
  });

  it("calls config.load before checking debug", async () => {
    const logger = new Logger(mockConfig as unknown as BaseConfig);
    await logger.debug("x");
    expect(mockConfig.load).toHaveBeenCalled();
  });
});
