// https://stackoverflow.com/a/6969486
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}
const filePrefix = new RegExp("^" + escapeRegExp("file://"));

const hr = new RegExp("^" + escapeRegExp(`file://${nova.environment["HOME"]}`));
const stdVolumePrefix = new RegExp(
  "^" + escapeRegExp("file:///Volumes/Macintosh HD")
);
export function cleanPath(path: string) {
  path = decodeURIComponent(path);
  if (nova.workspace.path) {
    path = path.replace(
      new RegExp("^" + escapeRegExp(`file://${nova.workspace.path}`)),
      "."
    );
  } else {
    path = path.replace(stdVolumePrefix, "file://");
  }
  return (
    path
      .replace(hr, "~")
      // needs to go last
      .replace(filePrefix, "")
  );
}
