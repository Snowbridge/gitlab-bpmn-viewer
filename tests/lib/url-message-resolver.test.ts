import { describe, it, expect } from "vitest";
import {
  MESSAGE_TYPE_BLOB_CONTENT_INIT,
  MESSAGE_TYPE_DIFF_CONTENT_INIT,
} from "@/types/messages";
import urlMessageResolver from "@/lib/url-message-resolver";

describe("urlMessageResolver", () => {
  it("returns MESSAGE_TYPE_BLOB_CONTENT_INIT for blob .bpmn URL", () => {
    const url = "/group/repo/-/blob/main/path/to/diagram.bpmn";
    expect(urlMessageResolver(url)).toBe(MESSAGE_TYPE_BLOB_CONTENT_INIT);
  });

  it("returns MESSAGE_TYPE_BLOB_CONTENT_INIT for blob URL without leading slash", () => {
    const url = "group/repo/-/blob/feature/foo.bpmn";
    expect(urlMessageResolver(url)).toBe(MESSAGE_TYPE_BLOB_CONTENT_INIT);
  });

  it("returns MESSAGE_TYPE_BLOB_CONTENT_INIT for .bpmn in path (case insensitive)", () => {
    const url = "/a/b/-/blob/ref/file.BPMN";
    expect(urlMessageResolver(url)).toBe(MESSAGE_TYPE_BLOB_CONTENT_INIT);
  });

  it("returns MESSAGE_TYPE_DIFF_CONTENT_INIT for merge_requests diffs URL", () => {
    const url = "/group/repo/-/merge_requests/42/diffs";
    expect(urlMessageResolver(url)).toBe(MESSAGE_TYPE_DIFF_CONTENT_INIT);
  });

  it("returns MESSAGE_TYPE_DIFF_CONTENT_INIT for MR diffs without leading slash", () => {
    const url = "group/repo/-/merge_requests/1/diffs";
    expect(urlMessageResolver(url)).toBe(MESSAGE_TYPE_DIFF_CONTENT_INIT);
  });

  it("returns undefined for non-matching URL", () => {
    expect(urlMessageResolver("/group/repo")).toBeUndefined();
    expect(urlMessageResolver("/group/repo/-/blob/main/readme.md")).toBeUndefined();
    expect(urlMessageResolver("/group/repo/-/merge_requests/1")).toBeUndefined();
  });
});
