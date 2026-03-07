import { describe, it, expect } from "vitest";
import {
  MESSAGE_TYPE_CONFIG_CHANGED,
  MESSAGE_TYPE_CONTENT_SCRIPT_READY,
  MESSAGE_TYPE_DEBUG,
  MESSAGE_TYPE_DIFF_CONTENT_INIT,
  MESSAGE_TYPE_BLOB_CONTENT_INIT,
} from "@/types/messages";

describe("messages", () => {
  it("MESSAGE_TYPE_CONFIG_CHANGED is defined", () => {
    expect(MESSAGE_TYPE_CONFIG_CHANGED).toBe("gl-bpmn-viewer-config-changed");
  });

  it("MESSAGE_TYPE_CONTENT_SCRIPT_READY is defined", () => {
    expect(MESSAGE_TYPE_CONTENT_SCRIPT_READY).toBe("gl-bpmn-viewer-content-script-ready");
  });

  it("MESSAGE_TYPE_BLOB_CONTENT_INIT is defined", () => {
    expect(MESSAGE_TYPE_BLOB_CONTENT_INIT).toBe("gl-bpmn-viewer-content-init-blob");
  });

  it("MESSAGE_TYPE_DIFF_CONTENT_INIT is defined", () => {
    expect(MESSAGE_TYPE_DIFF_CONTENT_INIT).toBe("gl-bpmn-viewer-content-init-diff");
  });

  it("MESSAGE_TYPE_DEBUG is defined", () => {
    expect(MESSAGE_TYPE_DEBUG).toBe("gl-bpmn-viewer-debug-message");
  });
});
