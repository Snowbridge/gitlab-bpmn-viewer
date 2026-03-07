import { describe, it, expect, vi, beforeEach } from "vitest";
import { DeferredMountPointExecutor } from "@/content/deferred-executor";
import type { BaseConfig } from "@/lib/configuration";
import type { Logger } from "@/lib/logger";

const executeCalls: number[] = [];
class ConcreteExecutor extends DeferredMountPointExecutor {
  async execute(): Promise<this> {
    executeCalls.push(1);
    return this;
  }

  getMountPointForTest() {
    return this.getMountPointElement();
  }
}

describe("DeferredMountPointExecutor", () => {
  let mockLogger: { debug: ReturnType<typeof vi.fn> };
  let mockConfig: BaseConfig;

  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    executeCalls.length = 0;
    mockLogger = { debug: vi.fn() };
    mockConfig = { load: vi.fn().mockResolvedValue(undefined) } as unknown as BaseConfig;
  });

  it("calls execute when mount point exists in DOM", async () => {
    const mount = document.createElement("div");
    mount.id = "fileHolder";
    document.body.appendChild(mount);

    new ConcreteExecutor("#fileHolder", mockConfig, mockLogger as unknown as Logger);
    await Promise.resolve();

    expect(executeCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not throw when mount point is missing (starts observing)", async () => {
    expect(() => {
      new ConcreteExecutor("#nonexistent-mount", mockConfig, mockLogger as unknown as Logger);
    }).not.toThrow();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      "Mount point is not found during content script initialization"
    );
    // Добавляем узел по селектору — body observer находит его и отключается, чтобы не срабатывать после teardown
    const node = document.createElement("div");
    node.id = "nonexistent-mount";
    document.body.appendChild(node);
    await Promise.resolve();
  });

  it("getMountPointElement returns element when present", () => {
    const mount = document.createElement("div");
    mount.id = "target";
    document.body.appendChild(mount);

    const executor = new ConcreteExecutor("#target", mockConfig, mockLogger as unknown as Logger);
    expect(executor.getMountPointForTest()).toBe(mount);
  });

  it("getMountPointElement returns null when absent", async () => {
    const executor = new ConcreteExecutor("#absent", mockConfig, mockLogger as unknown as Logger);
    expect(executor.getMountPointForTest()).toBeNull();
    // Добавляем узел по селектору — body observer отключается
    const node = document.createElement("div");
    node.id = "absent";
    document.body.appendChild(node);
    await Promise.resolve();
  });

  it("stopMountPointObserver does not throw when no observer", () => {
    const mount = document.createElement("div");
    mount.id = "m";
    document.body.appendChild(mount);
    const executor = new ConcreteExecutor("#m", mockConfig, mockLogger as unknown as Logger);
    expect(() => executor.stopMountPointObserver()).not.toThrow();
  });
});
