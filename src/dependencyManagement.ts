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

interface InstallationOptions {
  console?: Partial<Console>;
}

const globalConsole = console;

export async function installWrappedDependencies(
  compositeDisposable: CompositeDisposable,
  options: InstallationOptions = {}
) {
  const console = Object.assign({}, globalConsole, options.console);

  const dependencyDirectory = getDependencyDirectory();

  function copyForInstall(file: string) {
    try {
      const src = nova.path.join(nova.extension.path, file);
      const dst = nova.path.join(dependencyDirectory, file);
      if (nova.fs.access(dst, nova.fs.constants.F_OK)) {
        nova.fs.remove(dst);
      }
      nova.fs.copy(src, dst);
    } catch (err) {
      console.warn(err);
    }
  }

  nova.fs.mkdir(dependencyDirectory);

  // since this extension can run from multiple workspaces, we need to lock this directory to avoid
  // multiple workspace processes writing at the same time
  const lockFilePath = nova.path.join(dependencyDirectory, "LOCK");
  let lockFile: File;
  try {
    // claim a lock
    lockFile = nova.fs.open(lockFilePath, "x");
    console.log("claimed lock");
  } catch (err) {
    console.log("already locked");
    // expected error if file is already present, aka a lock has been acquired
    // wait until it's gone. That indicates another workspace has completed the install
    // note: can't use file watcher here since it's workspace relative
    return new Promise((resolve) =>
      setInterval(() => {
        if (!nova.fs.access(lockFilePath, nova.fs.constants.F_OK)) {
          resolve();
        }
      }, 500)
    );
  }
  lockFile.close();

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
      process.onStdout((o) => console.info("installing:", trimRight(o)));
      process.onStderr((e) => {
        console.warn("installing:", trimRight(e));
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
          }
        },
      });
      process.start();
    });
  } finally {
    clearLock();
    done = true;
  }
}
