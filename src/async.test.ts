import { showChoicePalette } from "./async";

describe("showChoicePalette", () => {
  const mockChoicePalette = jest.fn();
  (nova.workspace as any) = { showChoicePalette: mockChoicePalette };

  beforeEach(() => {
    mockChoicePalette.mockReset();
  });

  it("provides async access to the choice palette, returning your choice", async () => {
    mockChoicePalette.mockImplementationOnce((_a, _b, cb) => {
      cb(null, 1);
    });
    const choices = [Symbol("A"), Symbol("B")];
    const choice = await showChoicePalette(
      choices,
      (symbol) => symbol.toString() + "__choice",
      {
        placeholder: "placeholder",
      }
    );
    expect(choice).toBe(choices[1]);
    expect(mockChoicePalette.mock.calls[0]).toMatchInlineSnapshot(`
      Array [
        Array [
          "Symbol(A)__choice",
          "Symbol(B)__choice",
        ],
        Object {
          "placeholder": "placeholder",
        },
        [Function],
      ]
    `);
  });

  it("returns null on no choice", async () => {
    mockChoicePalette.mockImplementationOnce((_a, _b, cb) => {
      cb(null, null);
    });
    const choices = [Symbol("A"), Symbol("B")];
    const choice = await showChoicePalette(
      choices,
      (symbol) => symbol.toString(),
      {
        placeholder: "placeholder",
      }
    );
    expect(choice).toBeNull();
  });
});
