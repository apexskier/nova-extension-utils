async function clearLock() {
  const lockFilePath = nova.path.join(getDependencyDirectory(), "LOCK");
  nova.fs.remove(lockFilePath);
}

export function registerDependencyUnlockCommand(command: string) {
  nova.commands.register(command, clearLock);
}

// note: the reason this isn't a normal string export is because it relies on the nova global
// in tests, this can be annoying
export function getDependencyDirectory(): string {
  return nova.path.join(
    nova.extension.globalStoragePath,
    "dependencyManagement"
  );
}

// https://github.com/es-shims/String.prototype.trimEnd/blob/master/implementation.js
// eslint-disable-next-line no-control-regex
const endWhitespace = /[\x09\x0A\x0B\x0C\x0D\x20\xA0\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\u2028\u2029\uFEFF]*$/;

function trimRight(str: string) {
  return str.replace(endWhitespace, "");
}

const fiveMinutes = 5 * 60 * 1000;
const lockCheckInterval = 500;

interface InstallationOptions {
  console?: Partial<Console> | null;
}

async function asyncSetTimeout(cb: () => void, time: number) {
  await new Promise((resolve) =>
    setTimeout(() => {
      resolve(cb());
    }, time)
  );
}

const boundGlobalConsole: typeof console = {
  assert: console.assert.bind(console),
  clear: console.clear.bind(console),
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  group: console.group.bind(console),
  groupEnd: console.groupEnd.bind(console),
  count: console.count.bind(console),
  time: console.time.bind(console),
  timeEnd: console.timeEnd.bind(console),
  timeStamp: console.timeStamp?.bind(console),
  trace: console.trace.bind(console),
};

export async function installWrappedDependencies(
  compositeDisposable: CompositeDisposable,
  options: InstallationOptions = {}
) {
  const logger =
    options.console === null
      ? null
      : Object.assign({}, boundGlobalConsole, options.console);

  function copyForInstall(file: string) {
    try {
      const src = nova.path.join(nova.extension.path, file);
      const dst = nova.path.join(dependencyDirectory, file);
      if (nova.fs.access(dst, nova.fs.constants.F_OK)) {
        nova.fs.remove(dst);
      }
      nova.fs.copy(src, dst);
    } catch (err) {
      logger?.warn(err);
    }
  }

  const dependencyDirectory = getDependencyDirectory();

  nova.fs.mkdir(dependencyDirectory);

  // since this extension can run from multiple workspaces, we need to lock this directory to avoid
  // multiple workspace processes writing at the same time
  const lockFilePath = nova.path.join(dependencyDirectory, "LOCK");
  let lockFile: File;
  try {
    // claim a lock
    lockFile = nova.fs.open(lockFilePath, "x");
    logger?.log("claimed lock");
  } catch (err) {
    logger?.log("already locked");
    // expected error if file is already present, aka a lock has been acquired
    // wait until it's unlocked (another workspace completed install)
    try {
      await asyncSetTimeout(waitUntilUnlocked, lockCheckInterval);
      logger?.log("unlocked cleanly");
    } catch (err) {
      logger?.warn("unlocked", (err as Error).message);
      clearLock();
      // recurse
      await installWrappedDependencies(compositeDisposable, options);
    }
    return;
  }

  // three main methods
  // * happy path - lock file cleared
  // * install crashes without clearing lockfile - I'm a little worried about race conditions with this one, but it'll be graceful
  // * lockfile expires
  async function waitUntilUnlocked() {
    // Expected unlock path - lock file is removed
    // note: can't use file watcher here since it's workspace relative
    if (!nova.fs.access(lockFilePath, nova.fs.constants.F_OK)) {
      return;
    }

    const lockFile = nova.fs.open(lockFilePath) as FileTextMode;
    const pid = lockFile.read();
    lockFile.close();
    // once the install process starts running, the lockfile will be hold its PID
    // if it's not running any more, Nova's extension service might have crashed without clearing the lockfile
    // unfortunately, since the process isn't started atomically there's a gap between lock acquisition and
    // process starting, so this won't work if the crash happened early on
    if (pid) {
      const pidRunning = await new Promise<boolean>((resolve, reject) => {
        const process = new Process("/usr/bin/env", {
          args: ["ps", "-p", pid],
          stdio: "ignore",
        });
        process.onDidExit((status) => resolve(status == 0));
        compositeDisposable.add({
          dispose() {
            clearLock();
            process.terminate();
            reject(new Error("ps cancelled by disposable"));
          },
        });
        process.start();
      });
      if (!pidRunning) {
        throw new Error("install process not running");
      }
    }

    // this shouldn't take forever, if it times out kill everything and start over?
    const stats = nova.fs.stat(lockFilePath);
    if (stats && new Date().getTime() - stats.mtime.getTime() > fiveMinutes) {
      throw new Error("lockfile is too old");
    }

    // try again
    await asyncSetTimeout(waitUntilUnlocked, lockCheckInterval);
  }

  let done = false;

  try {
    copyForInstall("npm-shrinkwrap.json");
    copyForInstall("package.json");

    await new Promise((resolve, reject) => {
      const process = new Process("/usr/bin/env", {
        args: ["npm", "install"],
        cwd: dependencyDirectory,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          NO_UPDATE_NOTIFIER: "true",
        },
      });
      let errOutput = "";
      process.onStdout((o) => logger?.info("installing:", trimRight(o)));
      process.onStderr((e) => {
        logger?.warn("installing:", trimRight(e));
        errOutput += e;
      });
      process.onDidExit((status) => {
        if (status === 0) {
          resolve();
        } else {
          reject(new Error(`Failed to install:\n\n${errOutput}`));
        }
      });
      compositeDisposable.add({
        dispose() {
          if (!done) {
            clearLock();
            process.terminate();
            reject(new Error("install cancelled by disposable"));
          } else {
            resolve();
          }
        },
      });
      process.start();
      lockFile.write(String(process.pid));
      lockFile.close();
    });
  } finally {
    logger?.log("clearing lock");
    clearLock();
    done = true;
  }
}
