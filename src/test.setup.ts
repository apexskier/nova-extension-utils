declare const global: any;

(global as any).nova = {
  extension: {
    globalStoragePath: "/globalStorage",
  },
  environment: {
    HOME: "/home",
  },
  inDevMode() {
    return false;
  },
  path: {
    join(...args: string[]) {
      return args.join("/");
    },
  },
};
