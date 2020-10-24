# Contributing

## Development

### Running locally

Run `yarn` in a terminal to install dependencies.

Run the Nova Dev task to build scripts and auto-rebuild on file changes.

You can use [yarn linking](https://classic.yarnpkg.com/en/docs/cli/link/) to install your dev version in a an extension you're developing locally (you'll generally need to rebuild your extension manually when this rebuilds).

### Tests

This project has comprehensive tests using [Jest](http://jestjs.io). Because this project isn't run directly, it's important that any changes are tested. Remember that the Jest test environment is _not_ the Nova execution environment, so many things will need to be mocked.

You can debug using tests---see the [Jest troubleshooting documentation](https://jestjs.io/docs/en/troubleshooting).

## Pull Requests

### Changelog

All user-facing changes should be documented in [CHANGELOG.md](./CHANGELOG.md).

- If not present, add a `## future` section above the latest release
- If not present, add a `###` heading for the category of your changes. Categories can include
  - Breaking - backwards incompatible changes (semver major version bump)
  - Added - new features (semver minor version bump)
  - Fixed - bugfixes (semver patch version bump)
  - Changed - tweaks or changes that don't significantly change how the extension is used
- Add a single line for each change you've made

## Publishing notes

0. Checkout the main branch and ensure your local repo is clean and up-to-date.
1. Update the version
   - Replace `future` in the changelog to the new version (aggregate the changes to get a new semantic version)
   - Update the version in the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.md)
2. Run `yarn publish`. This will prompt you for the new version, update the `package.json` file, and create a new commit and tag.
3. Run `git push --follow-tags`.
