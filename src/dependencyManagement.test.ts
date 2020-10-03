declare const global: any;

import {
  installWrappedDependencies,
  registerDependencyUnlockCommand,
  dependencyDirectory,
} from "./dependencyManagement";

const F_OK = Symbol("F_OK");
(global as any).nova = Object.assign(nova, {
  commands: {
    register: jest.fn(),
  },
  extension: {
    globalStoragePath: "/globalStorage",
    path: "/extension",
  },
  fs: {
    constants: {
      F_OK,
    },
  },
});

jest.useFakeTimers();

test("dependencyDirectory", () => {
  expect(dependencyDirectory).toBe("/globalStorage/dependencyManagement");
});

describe("unlock command", () => {
  it("registers a lock clearing command", () => {
    registerDependencyUnlockCommand("command.id");
    expect(nova.commands.register).toBeCalledTimes(1);
    expect(nova.commands.register).toBeCalledWith(
      "command.id",
      expect.any(Function)
    );

    console.log((nova.commands.register as jest.Mock).mock.calls[0][1]);
  });
});

describe("dependencyManagement", () => {
  const compositeDisposable = ({
    add: jest.fn(),
  } as any) as CompositeDisposable;
  const mockFile = { close: jest.fn() };
  global.console.log = jest.fn();
  nova.fs.open = jest.fn();
  nova.fs.copy = jest.fn();
  nova.fs.remove = jest.fn();
  nova.fs.mkdir = jest.fn();
  nova.fs.access = jest.fn();
  const ProcessMock: jest.Mock<Partial<
    Process
  >> = jest.fn().mockImplementationOnce(() => ({
    onStdout: jest.fn(),
    onStderr: jest.fn(),
    onDidExit: jest.fn((cb) => {
      cb(0);
      return { dispose: jest.fn() };
    }),
    start: jest.fn(),
  }));
  (global as any).Process = ProcessMock;

  beforeEach(() => {
    (compositeDisposable.add as jest.Mock).mockReset();
    (nova.fs.open as jest.Mock)
      .mockReset()
      .mockImplementationOnce(() => mockFile);
    (nova.fs.copy as jest.Mock).mockReset();
    (nova.fs.remove as jest.Mock).mockReset();
    (nova.fs.mkdir as jest.Mock).mockReset();
    (nova.fs.access as jest.Mock).mockReset();
    mockFile.close.mockReset();
    ProcessMock.mockReset();
  });

  function expectLockCleared() {
    expect(nova.fs.remove).toHaveBeenCalledTimes(1);
    expect(nova.fs.remove).toBeCalledWith(
      "/globalStorage/dependencyManagement/LOCK"
    );
  }

  it("installs dependencies into extension global storage, and locks globally while doing so", async () => {
    ProcessMock.mockImplementationOnce(() => ({
      onStdout: jest.fn(),
      onStderr: jest.fn(),
      onDidExit: jest.fn((cb) => {
        cb(0);
        return { dispose: jest.fn() };
      }),
      start: jest.fn(),
    }));

    await installWrappedDependencies(compositeDisposable);

    expect(nova.fs.mkdir).toBeCalledTimes(1);
    expect(nova.fs.mkdir).toBeCalledWith("/globalStorage/dependencyManagement");
    expect(nova.fs.open).toBeCalledTimes(1);
    expect(nova.fs.open).toBeCalledWith(
      "/globalStorage/dependencyManagement/LOCK",
      "x"
    );
    expect(mockFile.close).toBeCalledTimes(1);
    expect(nova.fs.access).toBeCalledTimes(2);
    expect(nova.fs.access).toHaveBeenNthCalledWith(
      1,
      "/globalStorage/dependencyManagement/npm-shrinkwrap.json",
      F_OK
    );
    expect(nova.fs.access).toHaveBeenNthCalledWith(
      2,
      "/globalStorage/dependencyManagement/package.json",
      F_OK
    );
    expect(nova.fs.copy).toBeCalledTimes(2);
    expect(nova.fs.copy).toHaveBeenNthCalledWith(
      1,
      "/extension/npm-shrinkwrap.json",
      "/globalStorage/dependencyManagement/npm-shrinkwrap.json"
    );
    expect(nova.fs.copy).toHaveBeenNthCalledWith(
      2,
      "/extension/package.json",
      "/globalStorage/dependencyManagement/package.json"
    );
    expect(Process).toBeCalledTimes(1);
    expect(Process).toHaveBeenCalledWith("/usr/bin/env", {
      args: ["npm", "install"],
      cwd: "/globalStorage/dependencyManagement",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        NO_UPDATE_NOTIFIER: "true",
      },
    });
    expect(compositeDisposable.add).toBeCalledTimes(1);
    expectLockCleared();
  });

  it("removes npm meta files first before replacing them", async () => {
    (nova.fs.open as jest.Mock).mockReset().mockImplementationOnce(() => {
      throw new Error("locked");
    });
    (nova.fs.access as jest.Mock)
      .mockReset()
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => true)
      .mockImplementationOnce(() => false);

    const p = installWrappedDependencies(compositeDisposable);

    expect(nova.fs.open).toBeCalledTimes(1);
    expect(nova.fs.open).toBeCalledWith(
      "/globalStorage/dependencyManagement/LOCK",
      "x"
    );
    expect(nova.fs.access).not.toBeCalled();

    // every half second, checks if lock is cleared
    jest.runTimersToTime(500);
    expect(nova.fs.access).toBeCalledTimes(1);
    expect(nova.fs.access).toBeCalledWith(
      "/globalStorage/dependencyManagement/LOCK",
      F_OK
    );
    jest.runTimersToTime(500);
    expect(nova.fs.access).toBeCalledTimes(2);
    jest.runTimersToTime(500);
    expect(nova.fs.access).toBeCalledTimes(3);

    await p;

    expect(mockFile.close).not.toBeCalled();
    expect(nova.fs.copy).not.toBeCalled();
    expect(Process).not.toBeCalled();
    expect(nova.fs.remove).not.toBeCalled();
  });

  it("fails if installation fails", async () => {
    global.console.warn = jest.fn();
    ProcessMock.mockImplementationOnce(() => ({
      onStdout: jest.fn(),
      onStderr: jest.fn((cb) => {
        cb("reason");
        return { dispose: jest.fn() };
      }),
      onDidExit: jest.fn((cb) => {
        cb(1);
        return { dispose: jest.fn() };
      }),
      start: jest.fn(),
    }));

    await expect(installWrappedDependencies(compositeDisposable)).rejects
      .toThrowErrorMatchingInlineSnapshot(`
            "Failed to install:

            reason"
          `);
  });

  it("hooks a disposable that can cancel and cleanup", async () => {
    const terminate = jest.fn();
    ProcessMock.mockImplementationOnce(() => ({
      onStdout: jest.fn(),
      onStderr: jest.fn(),
      onDidExit: jest.fn(() => {
        return { dispose: jest.fn() };
      }),
      start: jest.fn(),
      terminate,
    }));

    installWrappedDependencies(compositeDisposable);

    expect(nova.fs.remove).not.toBeCalled();
    expect(terminate).not.toBeCalled();

    const dispose = (compositeDisposable.add as jest.Mock).mock.calls[0][0]
      .dispose;
    dispose();

    expectLockCleared();
    expect(terminate).toBeCalledTimes(1);
  });
});
