import { cleanPath } from "./cleanPath";

describe("cleanPath", () => {
  beforeEach(() => {
    (nova as any).workspace = {};
  });

  it("strips file:/// prefix", () => {
    expect(cleanPath("file:///path")).toBe("/path");
  });

  it("cleans the workspace path", () => {
    (nova.workspace as any).path = "/workspace";
    expect(cleanPath("file:///workspace/path")).toBe("./path");
  });

  it("cleans without a workspace path", () => {
    (nova.workspace as any).path = null;
    expect(cleanPath("file:///workspace/path")).toBe("/workspace/path");
  });

  it("cleans home dir", () => {
    expect(cleanPath("file:///home/path")).toBe("~/path");
  });
});
