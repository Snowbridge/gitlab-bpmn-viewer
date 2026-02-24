import { describe, it, expect, vi, beforeEach } from "vitest";

import { parseBlobUrl, fetchFileRaw } from "../../src/lib/gitlab-api";

describe("parseBlobUrl", () => {
  it("парсит blob URL с файлом в корне", () => {
    const url = "https://gitlab.com/group/project/-/blob/main/diagram.bpmn";
    expect(parseBlobUrl(url)).toEqual({
      projectPath: "group/project",
      ref: "main",
      filePath: "diagram.bpmn",
    });
  });

  it("парсит blob URL с файлом в подпапке", () => {
    const url =
      "https://git.example.com/ns/subgroup/repo/-/blob/master/src/process.bpmn";
    expect(parseBlobUrl(url)).toEqual({
      projectPath: "ns/subgroup/repo",
      ref: "master",
      filePath: "src/process.bpmn",
    });
  });

  it("парсит blob URL с портом", () => {
    const url =
      "https://git.internal:8443/company/app/-/blob/develop/workflows/flow.bpmn";
    expect(parseBlobUrl(url)).toEqual({
      projectPath: "company/app",
      ref: "develop",
      filePath: "workflows/flow.bpmn",
    });
  });

  it("возвращает null для не-blob URL", () => {
    expect(parseBlobUrl("https://gitlab.com/group/project")).toBeNull();
  });

  it("возвращает null для не-.bpmn файла", () => {
    expect(
      parseBlobUrl("https://gitlab.com/group/project/-/blob/main/readme.md")
    ).toBeNull();
  });

  it("возвращает null для невалидного URL", () => {
    expect(parseBlobUrl("not-a-url")).toBeNull();
  });
});

describe("fetchFileRaw", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("формирует корректный URL и использует PRIVATE-TOKEN", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<bpmn />"),
    } as Response);

    await fetchFileRaw(
      "https://gitlab.com",
      "secret-token",
      "group/project",
      "main",
      "diagram.bpmn"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://gitlab.com/api/v4/projects/group%2Fproject/repository/files/diagram.bpmn/raw?ref=main",
      {
        headers: {
          "PRIVATE-TOKEN": "secret-token",
        },
      }
    );
  });

  it("кодирует путь к файлу с подпапками", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("<bpmn />"),
    } as Response);

    await fetchFileRaw(
      "https://gitlab.com",
      "token",
      "group/project",
      "main",
      "src/workflows/diagram.bpmn"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("repository/files/src%2Fworkflows%2Fdiagram.bpmn"),
      expect.any(Object)
    );
  });

  it("выбрасывает ошибку при не-2xx ответе", async () => {
    const mockFetch = vi.mocked(fetch);
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    } as Response);

    await expect(
      fetchFileRaw("https://gitlab.com", "token", "g/p", "main", "x.bpmn")
    ).rejects.toThrow("GitLab API error: 404 Not Found");
  });
});
