import Utils from "../app/utils"; // Adjust the import path as needed

describe("App utility functions", () => {
  test("sum(): adds two numbers correctly", () => {
    expect(Utils.sum(1, 2)).toBe(3);
    expect(Utils.sum(-1, -1)).toBe(-2);
    expect(Utils.sum(-1, 1)).toBe(0);
  });

  test("substract(): substracts two numbers correctly", () => {
    expect(Utils.substract(2, 1)).toBe(1);
    expect(Utils.substract(-1, -1)).toBe(0);
    expect(Utils.substract(-1, 1)).toBe(-2);
  });
});
