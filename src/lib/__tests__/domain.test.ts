import { describe, it, expect } from "vitest";
import {
  TEA_SALES_SCHEMA,
  cycleFor,
  shiftCycle,
  inCycle,
  toDDMMYY,
  fromDDMMYY,
  fromISODate,
  toISODate,
  reconcile,
  parseRows,
  totalRowLabel,
  isTotalRow,
  schemaForHeaders,
  SALES_INPUTS,
  num,
  money,
  SHOP,
  TABS,
  EXPENSE_CATEGORIES,
  isArchived,
  ARCHIVE_PREFIX,
  type SheetData,
} from "../domain";

describe("domain", () => {
  describe("SALES_INPUTS", () => {
    it("should export SALES_INPUTS array", () => {
      expect(SALES_INPUTS).toBeDefined();
      expect(Array.isArray(SALES_INPUTS)).toBe(true);
      expect(SALES_INPUTS.length).toBeGreaterThan(0);
    });

    it("should contain cash and online inputs", () => {
      expect(SALES_INPUTS).toContain("CASH");
      expect(SALES_INPUTS).toContain("ONLINE");
    });
  });

  describe("shop and tabs", () => {
    it("should be a single shop", () => {
      expect(SHOP.name).toBe("Arab Tea House");
    });

    it("should map modules to tabs", () => {
      expect(TABS.sales).toBe("TEA_SALES");
      expect(TABS.inventory).toBe("TEA_EXPENSES");
    });

    it("should have default expense categories", () => {
      expect(EXPENSE_CATEGORIES).toContain("Milk");
      expect(EXPENSE_CATEGORIES).toContain("Sugar");
      expect(EXPENSE_CATEGORIES).toContain("Tea");
      expect(EXPENSE_CATEGORIES).toContain("Bakery");
      expect(EXPENSE_CATEGORIES).toContain("Cold Drinks");
      expect(EXPENSE_CATEGORIES).toContain("Cigarettes");
      expect(EXPENSE_CATEGORIES).toContain("Tobacco");
      expect(EXPENSE_CATEGORIES).toContain("Gas");
      expect(EXPENSE_CATEGORIES).toContain("Others");
    });
  });

  describe("date utilities", () => {
    it("should convert dates to DD/MM/YY format", () => {
      const date = new Date(2025, 8, 15); // Sept 15, 2025
      expect(toDDMMYY(date)).toBe("15/09/25");
    });

    it("should parse DD/MM/YY dates", () => {
      const result = fromDDMMYY("15/09/25");
      expect(result?.getDate()).toBe(15);
      expect(result?.getMonth()).toBe(8);
      expect(result?.getFullYear()).toBe(2025);
    });

    it("should handle two-digit and four-digit years in parsing", () => {
      expect(fromDDMMYY("01/01/26")?.getFullYear()).toBe(2026);
      expect(fromDDMMYY("01/01/2026")?.getFullYear()).toBe(2026);
    });

    it("should convert to and from ISO dates", () => {
      const d = new Date(2025, 11, 5);
      expect(toISODate(d)).toBe("2025-12-05");
      const parsed = fromISODate("2025-12-05");
      expect(parsed.getFullYear()).toBe(2025);
      expect(parsed.getMonth()).toBe(11);
      expect(parsed.getDate()).toBe(5);
    });
  });

  describe("cycles (calendar month)", () => {
    it("should start on the 1st and end on the last day", () => {
      const cycle = cycleFor(new Date(2025, 8, 15));
      expect(cycle.start.getDate()).toBe(1);
      expect(cycle.end.getDate()).toBe(30); // September
    });

    it("should handle 31-day months", () => {
      const jan31 = cycleFor(new Date(2025, 0, 31));
      expect(jan31.end.getDate()).toBe(31);
      const feb = cycleFor(new Date(2025, 1, 5));
      expect(feb.end.getDate()).toBe(28);
    });

    it("should shift cycles by months", () => {
      const shifted = shiftCycle(cycleFor(new Date(2025, 0, 31)), 1);
      expect(shifted.start.getMonth()).toBe(1);
    });

    it("should detect dates inside a cycle", () => {
      const cycle = cycleFor(new Date(2025, 8, 15));
      expect(inCycle(new Date(2025, 8, 1), cycle)).toBe(true);
      expect(inCycle(new Date(2025, 8, 30), cycle)).toBe(true);
      expect(inCycle(new Date(2025, 9, 1), cycle)).toBe(false);
    });
  });

  describe("reconcile", () => {
    it("should sum cash and online into total", () => {
      const result = reconcile({ CASH: 800, ONLINE: 450 });
      expect(result.total).toBe(1250);
    });

    it("should have no discrepancy without a target column", () => {
      const result = reconcile({ CASH: 800, ONLINE: 450 });
      expect(result.discrepancy).toBe(0);
      expect(result.access).toBe(0);
      expect(result.shot).toBe(0);
    });

    it("should handle empty and missing values", () => {
      const result = reconcile({});
      expect(result.total).toBe(0);
    });
  });

  describe("number helpers", () => {
    it("should parse numeric strings and strip currency symbols", () => {
      expect(num("₹1,234.50")).toBe(1234.5);
      expect(num("abc")).toBe(0);
      expect(num(null)).toBe(0);
    });

    it("should format money as INR", () => {
      expect(money(1250)).toContain("1,250");
    });
  });

  describe("total rows", () => {
    it("should label a total row for a cycle", () => {
      const label = totalRowLabel(cycleFor(new Date(2025, 8, 15)));
      expect(label).toBe("TOTAL 01/09/25-30/09/25");
    });

    it("should detect total rows", () => {
      expect(isTotalRow("TOTAL 01/09/25-30/09/25")).toBe(true);
      expect(isTotalRow("15/09/25")).toBe(false);
    });
  });

  describe("schemaForHeaders", () => {
    it("should match the tea sales schema on CASH+ONLINE headers", () => {
      const schema = schemaForHeaders(["DATE", "CASH", "ONLINE", "TOTAL"]);
      expect(schema).toEqual(TEA_SALES_SCHEMA);
    });

    it("should return null for expense sheets", () => {
      expect(schemaForHeaders(["DATE", "Milk", "Sugar", "TOTAL"])).toBeNull();
    });
  });

  describe("archive helpers", () => {
    it("should detect archived headers", () => {
      expect(isArchived(`${ARCHIVE_PREFIX}Milk`)).toBe(true);
      expect(isArchived("Milk")).toBe(false);
    });
  });

  describe("parseRows", () => {
    it("should parse dated rows and skip totals/blanks", () => {
      const data: SheetData = {
        headers: ["DATE", "CASH", "ONLINE", "TOTAL"],
        rows: [
          ["14/10/26", "800", "450", "1250"],
          ["", "", "", ""],
          ["TOTAL 01/10/26-31/10/26", "800", "450", "1250"],
          ["15/10/26", "600", "300", "900"],
        ],
        rowNumbers: [2, 3, 4, 5],
      };
      const rows = parseRows(data);
      expect(rows).toHaveLength(2);
      expect(rows[0]!.dateText).toBe("14/10/26");
      expect(rows[0]!.values["TOTAL"]).toBe(1250);
      expect(rows[1]!.values["CASH"]).toBe(600);
    });
  });
});
