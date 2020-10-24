import * as pkg from ".";

test("smoke test", () => {
  expect(pkg).not.toBeFalsy();
  expect(pkg.cleanPath).not.toBeFalsy();
});
