import ExcelJS from "exceljs";

const HEADER_FILL = "FF1F4E78";
const HEADER_FONT = "FFFFFFFF";
const OPTIONAL_FILL = "FFD9EAF7";
const REQUIRED_FILL = "FFFFE1E1";

type TemplateColumn = {
  header: string;
  width: number;
  required?: boolean;
  note?: string;
};

const MAIN_COLUMNS: TemplateColumn[] = [
  {
    header: "프로젝트코드",
    width: 18,
    note: "선택 입력입니다. 입력하면 해당 값을 사용하고, 비워두면 GSTMYY_### 형식으로 자동채번합니다.",
  },
  { header: "프로젝트", width: 30, required: true, note: "필수 입력 항목입니다." },
  { header: "업무내용", width: 38 },
  { header: "설치장소", width: 22 },
  { header: "제어부 담당", width: 18 },
  { header: "설비부 담당", width: 18 },
  { header: "상태", width: 16 },
  { header: "비고", width: 28 },
];

const SUB_COLUMNS: TemplateColumn[] = [
  {
    header: "프로젝트코드",
    width: 18,
    note: "선택 입력입니다. 입력하면 해당 값을 사용하고, 비워두면 GSTSYY_### 형식으로 자동채번합니다.",
  },
  { header: "프로젝트", width: 30, required: true, note: "필수 입력 항목입니다." },
  { header: "업무내용", width: 38 },
  { header: "담당자", width: 18 },
  { header: "행선지", width: 20 },
  { header: "상태", width: 16 },
  { header: "비고", width: 28 },
];

export async function createProjectScheduleTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GUESAN ERP";
  workbook.created = new Date();
  workbook.modified = new Date();

  addGuideSheet(workbook);
  addProjectSheet(workbook, "MAIN PROJECT", MAIN_COLUMNS);
  addProjectSheet(workbook, "SUB PROJECT", SUB_COLUMNS);

  return workbook.xlsx.writeBuffer();
}

function addGuideSheet(workbook: ExcelJS.Workbook) {
  const sheet = workbook.addWorksheet("작성안내", {
    views: [{ showGridLines: false }],
  });
  sheet.columns = [{ width: 22 }, { width: 86 }];
  sheet.mergeCells("A1:B1");
  sheet.getCell("A1").value = "GUESAN ERP 프로젝트 업로드 작성안내";
  sheet.getCell("A1").font = { bold: true, size: 15, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
  sheet.getRow(1).height = 30;

  const guides = [
    ["파일 형식", ".xlsx 파일만 업로드할 수 있습니다."],
    ["시트명", "MAIN PROJECT, SUB PROJECT 시트명은 변경하지 마세요. 필요한 시트만 작성해도 됩니다."],
    ["프로젝트코드", "선택 입력입니다. 입력한 값은 그대로 사용하고 기존 코드와 같으면 해당 프로젝트를 갱신합니다. 공란은 MAIN GSTMYY_### / SUB GSTSYY_### 형식으로 자동채번하여 새 프로젝트로 저장합니다."],
    ["필수 항목", "프로젝트명은 필수입니다. 빈 행은 자동으로 제외됩니다."],
    ["일정", "프로젝트 일정은 엑셀 업로드 대상에서 제외되며 기존 일정은 변경되지 않습니다."],
    ["업로드 순서", "파일을 선택한 뒤 업로드하세요. 오류가 있으면 저장하지 않고 수정할 항목을 안내합니다."],
  ];

  guides.forEach(([label, description], index) => {
    const row = sheet.getRow(index + 3);
    row.values = [label, description];
    row.height = 28;
    row.getCell(1).font = { bold: true, color: { argb: "FF1F2937" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F5F9" } };
    row.eachCell((cell) => {
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFD8E0EA" } } };
    });
  });
}

function addProjectSheet(workbook: ExcelJS.Workbook, name: string, columns: TemplateColumn[]) {
  const sheet = workbook.addWorksheet(name, {
    views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
  });
  sheet.properties.defaultRowHeight = 21;
  sheet.columns = columns.map((column) => ({ width: column.width }));

  const headerRow = sheet.addRow(columns.map((column) => column.header));
  headerRow.height = 26;
  headerRow.eachCell((cell, columnNumber) => {
    const column = columns[columnNumber - 1];
    cell.font = {
      bold: true,
      color: { argb: column.required ? "FF9C0006" : columnNumber === 1 ? "FF1F4E78" : HEADER_FONT },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: column.required ? REQUIRED_FILL : columnNumber === 1 ? OPTIONAL_FILL : HEADER_FILL,
      },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    if (column.note) {
      cell.note = column.note;
    }
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
}
