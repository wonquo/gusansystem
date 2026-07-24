import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/Users/wonquo/Dev/06. GUSAN/gusan/outputs/project-upload-test-20260713";
const outputPath = `${outputDir}/프로젝트_업로드_테스트.xlsx`;
const execFileAsync = promisify(execFile);

const workbook = Workbook.create();
const guide = workbook.worksheets.add("작성안내");
const main = workbook.worksheets.add("MAIN PROJECT");
const sub = workbook.worksheets.add("SUB PROJECT");

const navy = "#1F4E78";
const border = "#D8E0EA";
const bodyText = "#24324A";
const mutedText = "#5C687B";

guide.showGridLines = false;
guide.mergeCells("A1:B1");
guide.getRange("A1").values = [["GUESAN ERP 프로젝트 업로드 테스트 파일"]];
guide.getRange("A1:B1").format = {
  fill: navy,
  font: { bold: true, color: "#FFFFFF", size: 15 },
  verticalAlignment: "center",
};
guide.getRange("A1:B1").format.rowHeight = 30;
guide.getRange("A3:B8").values = [
  ["목적", "프로젝트 엑셀 업로드의 미리보기와 저장 흐름을 확인하기 위한 테스트 파일입니다."],
  ["시트", "MAIN PROJECT와 SUB PROJECT에 각각 정상 테스트 데이터가 포함되어 있습니다."],
  ["프로젝트코드", "빈 코드는 자동채번되고, TEST-로 시작하는 코드는 입력값 그대로 사용됩니다."],
  ["일정", "줄바꿈된 일정이 여러 일정 항목으로 나뉘는지 확인할 수 있습니다."],
  ["주의", "최종 업로드를 누르면 실제 프로젝트 데이터로 저장됩니다."],
  ["권장 순서", "파일 선택 → 미리보기 결과 확인 → 필요할 때만 업로드"],
];
guide.getRange("A3:A8").format = {
  fill: "#F2F5F9",
  font: { bold: true, color: bodyText },
  verticalAlignment: "center",
};
guide.getRange("B3:B8").format = {
  font: { color: mutedText },
  wrapText: true,
  verticalAlignment: "center",
};
guide.getRange("A3:B8").format.borders = {
  top: { style: "thin", color: border },
  bottom: { style: "thin", color: border },
  left: { style: "thin", color: border },
  right: { style: "thin", color: border },
  insideHorizontal: { style: "thin", color: border },
};
guide.getRange("A3:B8").format.rowHeight = 30;
guide.getRange("A1:A8").format.columnWidth = 18;
guide.getRange("B1:B8").format.columnWidth = 78;

const mainHeaders = [
  "프로젝트코드",
  "프로젝트",
  "업무내용",
  "설치장소",
  "제어부 담당",
  "설비부 담당",
  "상태",
  "비고",
  "일정",
];
const mainRows = [
  [
    "",
    "테스트 MAIN 프로젝트 A",
    "제어반 설치 및 시운전",
    "하남 산업단지 A동",
    "김제어",
    "박설비",
    "진행",
    "자동채번 및 복수 일정 테스트",
    "2026-07-20 현장 미팅\n2026-07-25 시운전",
  ],
  [
    "TEST-MAIN-001",
    "테스트 MAIN 프로젝트 B",
    "설비 점검 및 결과 보고",
    "하남 물류센터",
    "이제어",
    "최설비",
    "대기",
    "입력 코드 유지 테스트",
    "2026-07-28 설비 점검",
  ],
  [
    "",
    "테스트 MAIN 프로젝트 C",
    "도면 검토",
    "하남 사무동",
    "정제어",
    "한설비",
    "완료",
    "일정 없는 프로젝트 테스트",
    "",
  ],
];

const subHeaders = [
  "프로젝트코드",
  "프로젝트",
  "업무내용",
  "담당자",
  "행선지",
  "상태",
  "비고",
  "일정",
];
const subRows = [
  [
    "",
    "테스트 SUB 프로젝트 A",
    "자재 발주 및 납품",
    "이담당",
    "하남",
    "대기",
    "자동채번 및 복수 일정 테스트",
    "2026-07-18 자재 발주\n2026-07-22 현장 납품",
  ],
  [
    "TEST-SUB-001",
    "테스트 SUB 프로젝트 B",
    "협력사 일정 조율",
    "김담당",
    "경기 광주",
    "진행",
    "입력 코드 유지 테스트",
    "2026-07-24 협력사 미팅",
  ],
];

function styleProjectSheet(sheet, headers, rows, widths, statusRange) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;

  const headerRange = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  headerRange.format = {
    fill: navy,
    font: { bold: true, color: "#FFFFFF" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: border },
  };
  headerRange.format.rowHeight = 27;

  sheet.getRange("A1").format = {
    fill: "#D9EAF7",
    font: { bold: true, color: navy },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };
  sheet.getRange("B1").format = {
    fill: "#FFE1E1",
    font: { bold: true, color: "#9C0006" },
    horizontalAlignment: "center",
    verticalAlignment: "center",
  };

  const bodyRange = sheet.getRangeByIndexes(1, 0, rows.length, headers.length);
  bodyRange.format = {
    font: { color: bodyText },
    verticalAlignment: "center",
    wrapText: true,
    borders: {
      top: { style: "thin", color: border },
      bottom: { style: "thin", color: border },
      left: { style: "thin", color: border },
      right: { style: "thin", color: border },
      insideHorizontal: { style: "thin", color: border },
    },
  };
  bodyRange.format.rowHeight = 40;

  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, rows.length + 1, 1).format.columnWidth = width;
  });

  sheet.getRange(statusRange).dataValidation = {
    rule: { type: "list", values: ["대기", "진행", "완료"] },
  };
}

styleProjectSheet(main, mainHeaders, mainRows, [18, 30, 36, 24, 18, 18, 14, 30, 34], "G2:G100");
styleProjectSheet(sub, subHeaders, subRows, [18, 30, 36, 18, 20, 14, 30, 34], "F2:F100");

await fs.mkdir(outputDir, { recursive: true });

for (const [sheetName, range, fileName] of [
  ["작성안내", "A1:B8", "preview-guide.png"],
  ["MAIN PROJECT", "A1:I4", "preview-main.png"],
  ["SUB PROJECT", "A1:H3", "preview-sub.png"],
]) {
  const preview = await workbook.render({ sheetName, range, scale: 1.5, format: "png" });
  await fs.writeFile(`${outputDir}/${fileName}`, new Uint8Array(await preview.arrayBuffer()));
}

const inspection = await workbook.inspect({
  kind: "table",
  range: "'MAIN PROJECT'!A1:I4",
  include: "values,formulas",
  tableMaxRows: 6,
  tableMaxCols: 10,
});
console.log(inspection.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);

const compatibilityDir = await fs.mkdtemp(path.join(os.tmpdir(), "guesan-project-xlsx-"));
await execFileAsync("/usr/bin/unzip", ["-q", outputPath, "-d", compatibilityDir]);

async function normalizeSpreadsheetXml(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await normalizeSpreadsheetXml(entryPath);
    } else if (entry.name.endsWith(".xml")) {
      const source = await fs.readFile(entryPath, "utf8");
      const normalized = source
        .replaceAll("<x:", "<")
        .replaceAll("</x:", "</")
        .replace('xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"');
      if (normalized !== source) {
        await fs.writeFile(entryPath, normalized, "utf8");
      }
    }
  }
}

await normalizeSpreadsheetXml(path.join(compatibilityDir, "xl"));
await fs.rm(outputPath);
await execFileAsync("/usr/bin/zip", ["-qr", outputPath, "."], { cwd: compatibilityDir });
await fs.rm(compatibilityDir, { recursive: true, force: true });
console.log(outputPath);
