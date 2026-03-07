import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchFileRaw, getMergeRequestRefs } from "@/lib/gitlab-api";

describe("gitlab-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  describe("fetchFileRaw", () => {
    it("builds correct URL and returns text on success", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        text: () => Promise.resolve("<bpmn/>"),
      } as Response);

      const result = await fetchFileRaw(
        "https://git.example.com",
        "token",
        "group/repo",
        "main",
        "path/to/file.bpmn"
      );

      expect(result).toBe("<bpmn/>");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://git.example.com/api/v4/projects/group%2Frepo/repository/files/path%2Fto%2Ffile.bpmn/raw?ref=main",
        expect.objectContaining({
          headers: { "PRIVATE-TOKEN": "token" },
        })
      );
    });

    it("strips trailing slash from origin", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve("") } as Response);

      await fetchFileRaw(
        "https://git.example.com/",
        "t",
        "p",
        "r",
        "f.bpmn"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://git.example.com/api/v4/projects/p/repository/files/f.bpmn/raw?ref=r",
        expect.any(Object)
      );
    });

    it("throws on non-ok response", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      await expect(
        fetchFileRaw("https://git.example.com", "t", "p", "r", "f.bpmn")
      ).rejects.toThrow("GitLab API error: 404 Not Found");
    });
  });

  describe("getMergeRequestRefs", () => {
    it("returns source and target from diff_refs when present", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            source_branch: "main",
            target_branch: "feature",
            diff_refs: {
              base_sha: "aaa",
              start_sha: "startSha",
              head_sha: "headSha",
            },
          }),
      } as Response);

      const result = await getMergeRequestRefs(
        "https://git.example.com",
        "token",
        "group/repo",
        "1"
      );

      expect(result).toEqual({ source: "startSha", target: "headSha" });
    });

    it("falls back to source_branch and target_branch when no diff_refs", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            source_branch: "main",
            target_branch: "feature",
          }),
      } as Response);

      const result = await getMergeRequestRefs(
        "https://git.example.com",
        "token",
        "g/r",
        "2"
      );

      expect(result).toEqual({ source: "main", target: "feature" });
    });

    it("builds correct MR API URL", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ source_branch: "a", target_branch: "b" }),
      } as Response);

      await getMergeRequestRefs(
        "https://git.example.com",
        "t",
        "group/repo",
        "42"
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://git.example.com/api/v4/projects/group%2Frepo/merge_requests/42",
        expect.objectContaining({ headers: { "PRIVATE-TOKEN": "t" } })
      );
    });

    it("throws on API error", async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      await expect(
        getMergeRequestRefs("https://git.example.com", "t", "p", "1")
      ).rejects.toThrow("GitLab API error: 401 Unauthorized");
    });
  });
});
