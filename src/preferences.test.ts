import { getOverridableBoolean } from "./preferences";

describe("getOverridableBoolean", () => {
  beforeEach(() => {
    (nova as any).workspace = {
      config: {
        get: jest.fn(),
      },
    };
    (nova as any).config = {
      get: jest.fn(),
    };
  });

  it("defaults to null", () => {
    expect(getOverridableBoolean("configKey")).toBe(null);

    expect(nova.workspace.config.get as jest.Mock).toBeCalledTimes(1);
    expect(nova.workspace.config.get as jest.Mock).toBeCalledWith(
      "configKey",
      "string"
    );
    expect(nova.config.get as jest.Mock).toBeCalledTimes(1);
    expect(nova.config.get as jest.Mock).toBeCalledWith("configKey", "boolean");
  });

  it("can be disabled globally", () => {
    (nova.workspace.config.get as jest.Mock).mockReturnValueOnce(null);
    (nova.config.get as jest.Mock).mockReturnValueOnce(false);
    expect(getOverridableBoolean("configKey")).toBe(false);
  });

  it("can be enabled globally", () => {
    (nova.workspace.config.get as jest.Mock).mockReturnValueOnce(null);
    (nova.config.get as jest.Mock).mockReturnValueOnce(true);
    expect(getOverridableBoolean("configKey")).toBe(true);
  });

  it("can be disabled in the workspace", () => {
    (nova.workspace.config.get as jest.Mock).mockReturnValueOnce("false");
    (nova.config.get as jest.Mock).mockReturnValueOnce(true);
    expect(getOverridableBoolean("configKey")).toBe(false);
  });

  it("can be enabled in the workspace", () => {
    (nova.workspace.config.get as jest.Mock).mockReturnValueOnce("true");
    (nova.config.get as jest.Mock).mockReturnValueOnce(false);
    expect(getOverridableBoolean("configKey")).toBe(true);
  });
});
