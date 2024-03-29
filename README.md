⚠️ **Archived**: Although it was fun to build my nova extensions, I haven't ended up using Nova regularly and can't devote the time to maintenance. Feel free to reach out if you want to fork and start maintaining an alternative.

# `nova-extension-utils`

This package provides sharable utilities for building [Nova](http://nova.app) extensions.

## Features

### `installWrappedDependencies`

This function provides a concurrent-safe, reproducible, non-global-polluting mechanism for installing external nodejs dependencies executed by your extension, without bundling them within the extension artifact and increasing extension size. This is especially useful in dev, as it won't trigger reloads of the extension recursively.

To use it, you _must_ have a valid [`package.json`](https://docs.npmjs.com/files/package.json) and [`npm-shrinkwrap.json`](https://docs.npmjs.com/configuring-npm/shrinkwrap-json.html) file in your `.novaextension` directory. They'll be copied into your extension's global storage and used to install dependencies specified in the shrinkwrap file. An atomic file lock is used to prevent multiple workspaces writing over each other.

#### `installWrappedDependencies`

This is an async function that handles installation. Call it during extension activation. It takes a two parameters

1. A [composite disposable](https://docs.nova.app/api-reference/composite-disposable/) that on disposal kills the installation process and unlocks. Be sure to dispose when the extension deactivates.
2. An optional options object with the optional properties.
   - `console` an object who's properties override those of [`Console`](https://docs.nova.app/api-reference/console/). Pass `null` to fully disable `console` calls.

#### `registerDependencyUnlockCommand`

Registers a global command that will force unlock. Not required, but can be useful to cleanup if crashes happen. Make sure to [define the command](https://docs.nova.app/extensions/commands/) to give users access.

#### `getDependencyDirectory`

Returns a path to the directory containing the installed `node_modules` directory.

<details>

<summary>Here's a full example of usage</summary>

```ts
import { dependencyManagement } from "nova-extension-utils";

const compositeDisposable = new CompositeDisposable();

dependencyManagement.registerDependencyUnlockCommand(
  "com.example.extension.unlock"
);

async function asyncActivate() {
  await dependencyManagement.installWrappedDependencies(compositeDisposable, {
    console: {
      log(...args: Array<unknown>) {
        console.log("dependency management:", ...args);
      },
    },
  });

  const execPath = nova.path.join(
    dependencyManagement.getDependencyDirectory(),
    "node_modules",
    ".bin",
    "executable"
  );
  const process = new Process(execPath);
  compositeDisposable.add({
    dispose() {
      process.terminate();
    },
  });
  process.start();
}

export function activate() {
  console.log("activating...");
  return asyncActivate()
    .catch((err) => {
      console.error(err);
    })
    .then(() => {
      console.log("activated");
    });
}

export function deactivate() {
  compositeDisposable.dispose();
}
```

</details>

### `asyncNova`

#### `showChoicePalette`

Asyncronous, generic, non-index-based access to the choice palette.

<details>

<summary>Example of use</summary>

```ts
import type * as lspTypes from "vscode-languageserver-protocol";
import { asyncNova } from "nova-extension-utils";

async function foo(items: lspTypes.CompletionItem[]) {
  const choice: lspTypes.CompletionItem | null = await asyncNova(
    items,
    (item) => `${item.label}${item.detail ? `- ${item.detail}` : ""}`,
    { placeholder: "suggestions" }
  );
  if (!choice) {
    return;
  }
  console.log(choice);
}
```

</details>

### `cleanPath`

Function to nicely format paths and file URIs for user-display. Replaces `$HOME` with `~/`, removes volume and `file://`, and replaces workspace path with `./`.

<details>

<summary>Example of use</summary>

```ts
import { cleanPath } from "nova-extension-utils";

console.log(cleanPath(editor.document.uri));
```

</details>

### `preferences`

#### `getOverridableBoolean`

This provides a common pattern to have a boolean preference that can be set globally or per-workspace, but allows the workspace to override the global preference. The user has the ability to set a preference globally, but they can override it in each workspace. I recommend defaulting to the least-destructive/mutating action globally, to help make it easier to work in shared codebases.

This expects the preference to be set up properly in your extension manifest. You'll configure a global-level boolean (with any default value), and a workspace-level enum (with three possible values of "null", "false", and "true" and a default of "null") with the same preference key.

<details>

```json
{
  "config": [
    {
      "key": "apexskier.example.config.myPreference",
      "title": "Example",
      "type": "boolean",
      "default": false
    }
  ],

  "configWorkspace": [
    {
      "key": "apexskier.example.config.myPreference",
      "title": "Example",
      "type": "enum",
      "values": [
        ["null", "Inherit from Global Settings"],
        ["false", "Disable"],
        ["true", "Enable"]
      ],
      "default": "null"
    }
  ]
}
```

```ts
import { preferences } from "nova-extension-utils";

const defaultPrefValue = false;
const prefValue: boolean =
  preferences.getOverridableBoolean("apexskier.example.config.myPreference") ??
  defaultPrefValue;
```

</details>
