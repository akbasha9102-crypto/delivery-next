import ExcelJS from 'exceljs';

export type StatsExportData = {
  fromDate: string;
  toDate: string;
  rangeLabel: string;
  summary: { ordersCount: number; totalRevenue: number; avgOrder: number };
  byOrderType: { name: string; count: number; revenue: number }[];
  byCategory: { name: string; count: number; revenue: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  inventory: { name: string; unit: string; total: number }[];
  inventoryDetail: { itemName: string; unit: string; orderClient: string; qty: number; time: string }[];
  ordersSummary: {
    orderId: string;
    createdAt: string;
    orderTypeLabel: string;
    customerOrTable: string;
    status: string;
    total: number;
  }[];
  orderItems: {
    orderId: string;
    createdAt: string;
    orderTypeLabel: string;
    tableNumber: string | number;
    clientName: string;
    clientPhone: string;
    address: string;
    note: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
    subtotal: number;
    deliveryFee: number;
    discountAmount: number;
    couponCode: string;
    orderTotal: number;
  }[];
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function periodLabel(data: StatsExportData) {
  const dates = data.fromDate === data.toDate ? data.fromDate : `${data.fromDate}_إلى_${data.toDate}`;
  return `${data.rangeLabel}_${dates}`;
}

// ---------- Excel styling helpers ----------

const COLOR = {
  headerBg: 'FF2C3E50',
  headerText: 'FFFFFFFF',
  zebra: 'FFF8F9F9',
  border: 'FFD5DBDB',
  titleText: 'FF2C3E50',
  cardValueBg: 'FFECF0F1',
  revenue: 'FF27AE60',
  count: 'FF2980B9',
  avg: 'FFE67E22',
};

const CURRENCY_FMT = '#,##0" د.ع"';
const NUMBER_FMT = '#,##0';

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLOR.border } },
  bottom: { style: 'thin', color: { argb: COLOR.border } },
  left: { style: 'thin', color: { argb: COLOR.border } },
  right: { style: 'thin', color: { argb: COLOR.border } },
};

function colLetter(n: number) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function addSectionTitle(sheet: ExcelJS.Worksheet, row: number, text: string, colSpan: number) {
  sheet.mergeCells(`A${row}:${colLetter(colSpan)}${row}`);
  const cell = sheet.getCell(`A${row}`);
  cell.value = text;
  cell.font = { bold: true, size: 12, color: { argb: COLOR.titleText } };
  cell.alignment = { horizontal: 'right', vertical: 'middle' };
  sheet.getRow(row).height = 20;
  return row + 1;
}

/** Draws a header + zebra-striped data table starting at `row`. Returns the next free row (with a blank gap). */
function addStyledTable(
  sheet: ExcelJS.Worksheet,
  row: number,
  headers: string[],
  rows: (string | number)[][],
  currencyCols: number[] = []
) {
  const headerRow = sheet.getRow(row);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    cell.font = { bold: true, color: { argb: COLOR.headerText } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
  });
  headerRow.height = 20;

  rows.forEach((r, idx) => {
    const dataRow = sheet.getRow(row + 1 + idx);
    r.forEach((val, i) => {
      const cell = dataRow.getCell(i + 1);
      cell.value = val;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
      }
      if (currencyCols.includes(i) && typeof val === 'number') {
        cell.numFmt = CURRENCY_FMT;
      } else if (typeof val === 'number') {
        cell.numFmt = NUMBER_FMT;
      }
    });
  });

  return row + rows.length + 2;
}

type KpiCard = { label: string; value: number; colorArgb: string; currency: boolean };

/** Draws up to 3 merged KPI cards side by side, spanning `colsPerCard` columns each. Returns next free row. */
function addKpiCards(sheet: ExcelJS.Worksheet, row: number, cards: KpiCard[], colsPerCard = 3) {
  const labelRow = row;
  const valueRow = row + 1;

  cards.forEach((c, i) => {
    const startCol = i * colsPerCard + 1;
    const endCol = startCol + colsPerCard - 1;
    const startLetter = colLetter(startCol);
    const endLetter = colLetter(endCol);

    sheet.mergeCells(`${startLetter}${labelRow}:${endLetter}${labelRow}`);
    const labelCell = sheet.getCell(`${startLetter}${labelRow}`);
    labelCell.value = c.label;
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
    labelCell.font = { bold: true, size: 11, color: { argb: COLOR.headerText } };
    labelCell.alignment = { horizontal: 'center', vertical: 'middle' };
    labelCell.border = thinBorder;

    sheet.mergeCells(`${startLetter}${valueRow}:${endLetter}${valueRow}`);
    const valueCell = sheet.getCell(`${startLetter}${valueRow}`);
    valueCell.value = c.value;
    valueCell.numFmt = c.currency ? CURRENCY_FMT : NUMBER_FMT;
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.cardValueBg } };
    valueCell.font = { bold: true, size: 16, color: { argb: c.colorArgb } };
    valueCell.alignment = { horizontal: 'center', vertical: 'middle' };
    valueCell.border = thinBorder;
  });

  sheet.getRow(labelRow).height = 20;
  sheet.getRow(valueRow).height = 28;
  return valueRow + 2;
}

/** True auto-fit: sizes every column to its longest cell content. Only safe on sheets with no merged cells. */
function autoFitColumns(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach(col => {
    let max = 10;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? '').length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 55);
  });
}

// ---------- Excel export ----------

export async function exportStatisticsToExcel(data: StatsExportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'الداشبورد';
  wb.created = new Date();

  // ===== Sheet 1: ملخص عام =====
  const summary = wb.addWorksheet('ملخص عام', { views: [{ rightToLeft: true }] });
  for (let c = 1; c <= 9; c++) summary.getColumn(c).width = 15;

  summary.mergeCells('A1:I1');
  const titleCell = summary.getCell('A1');
  titleCell.value = `تقرير الإحصائيات — ${data.rangeLabel} (${data.fromDate} إلى ${data.toDate})`;
  titleCell.font = { bold: true, size: 14, color: { argb: COLOR.titleText } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summary.getRow(1).height = 26;

  let row = 3;
  row = addKpiCards(summary, row, [
    { label: 'إجمالي الإيرادات (د.ع)', value: data.summary.totalRevenue, colorArgb: COLOR.revenue, currency: true },
    { label: 'عدد الطلبات المكتملة', value: data.summary.ordersCount, colorArgb: COLOR.count, currency: false },
    { label: 'متوسط قيمة الطلب (د.ع)', value: data.summary.avgOrder, colorArgb: COLOR.avg, currency: true },
  ]);
  row += 1;

  if (data.byCategory.length) {
    row = addSectionTitle(summary, row, 'المبيعات حسب القسم', 3);
    row = addStyledTable(summary, row,
      ['القسم', 'عدد الطلبات', 'الإيراد (د.ع)'],
      data.byCategory.map(r => [r.name, r.count, Math.round(r.revenue)]),
      [2]);
  }

  if (data.byOrderType.length) {
    row = addSectionTitle(summary, row, 'المبيعات حسب نوع الطلب', 3);
    row = addStyledTable(summary, row,
      ['نوع الطلب', 'عدد الطلبات', 'الإيراد (د.ع)'],
      data.byOrderType.map(r => [r.name, r.count, r.revenue]),
      [2]);
  }

  if (data.topItems.length) {
    row = addSectionTitle(summary, row, 'الأصناف الأكثر مبيعاً', 3);
    addStyledTable(summary, row,
      ['الصنف', 'الكمية المباعة', 'الإيراد (د.ع)'],
      data.topItems.map(r => [r.name, r.qty, Math.round(r.revenue)]),
      [2]);
  }

  // ===== Sheet 2: تفاصيل الطلبات =====
  if (data.ordersSummary.length) {
    const detail = wb.addWorksheet('تفاصيل الطلبات', { views: [{ rightToLeft: true }] });
    addStyledTable(detail, 1,
      ['رقم الطلب', 'التاريخ والوقت', 'نوع الطلب', 'اسم العميل / الطاولة', 'الحالة', 'المبلغ (د.ع)'],
      data.ordersSummary.map(o => [o.orderId, o.createdAt, o.orderTypeLabel, o.customerOrTable, o.status, o.total]),
      [5]);
    autoFitColumns(detail);
  }

  // ===== Sheet 3: تفاصيل الأصناف (per line item, for deeper accounting review) =====
  if (data.orderItems.length) {
    const items = wb.addWorksheet('تفاصيل الأصناف', { views: [{ rightToLeft: true }] });
    addStyledTable(items, 1,
      ['رقم الطلب', 'التاريخ', 'نوع الطلب', 'رقم الطاولة', 'الزبون', 'الهاتف', 'العنوان', 'ملاحظة', 'الصنف', 'الكمية', 'سعر الوحدة (د.ع)', 'إجمالي الصنف (د.ع)', 'مجموع المشتريات (د.ع)', 'رسوم التوصيل (د.ع)', 'الخصم (د.ع)', 'كود الكوبون', 'الإجمالي المدفوع (د.ع)'],
      data.orderItems.map(o => [o.orderId, o.createdAt, o.orderTypeLabel, o.tableNumber, o.clientName, o.clientPhone, o.address, o.note, o.itemName, o.qty, o.unitPrice, o.lineTotal, o.subtotal, o.deliveryFee, o.discountAmount, o.couponCode, o.orderTotal]),
      [10, 11, 12, 13, 14, 16]);
    autoFitColumns(items);
  }

  // ===== Sheet 4: المخزون =====
  if (data.inventory.length) {
    const inv = wb.addWorksheet('المخزون', { views: [{ rightToLeft: true }] });
    addStyledTable(inv, 1, ['المادة', 'الوحدة', 'الكمية المستهلكة'],
      data.inventory.map(r => [r.name, r.unit, r.total]));
    autoFitColumns(inv);
  }

  // ===== Sheet 5: تفصيل استهلاك المخزون =====
  if (data.inventoryDetail.length) {
    const invDetail = wb.addWorksheet('تفصيل استهلاك المخزون', { views: [{ rightToLeft: true }] });
    addStyledTable(invDetail, 1, ['المادة', 'الطلب', 'الكمية', 'التاريخ'],
      data.inventoryDetail.map(r => [r.itemName, r.orderClient, r.qty, r.time]));
    autoFitColumns(invDetail);
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `إحصائيات_${periodLabel(data)}.xlsx`);
}

// ---------- Word export ----------

function table(headers: string[], rows: (string | number)[][]) {
  const head = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function exportStatisticsToWord(data: StatsExportData) {
  const sections: string[] = [];

  sections.push(`<h1>تقرير الإحصائيات</h1><p>النطاق: ${data.rangeLabel} — من ${data.fromDate} إلى ${data.toDate}</p>`);

  sections.push(`<h2>ملخص</h2>` + table(['البيان', 'القيمة'], [
    ['عدد الطلبات المكتملة', data.summary.ordersCount],
    ['إجمالي الإيراد (د.ع)', data.summary.totalRevenue],
    ['متوسط الطلب (د.ع)', data.summary.avgOrder],
  ]));

  if (data.byOrderType.length) {
    sections.push(`<h2>الإيراد حسب نوع الطلب</h2>` + table(['النوع', 'عدد الطلبات', 'الإيراد (د.ع)'],
      data.byOrderType.map(r => [r.name, r.count, r.revenue])));
  }

  if (data.byCategory.length) {
    sections.push(`<h2>الإيراد حسب القسم</h2>` + table(['القسم', 'عدد الطلبات', 'الإيراد (د.ع)'],
      data.byCategory.map(r => [r.name, r.count, Math.round(r.revenue)])));
  }

  if (data.topItems.length) {
    sections.push(`<h2>الأصناف الأكثر مبيعاً</h2>` + table(['الصنف', 'الكمية المباعة', 'الإيراد (د.ع)'],
      data.topItems.map(r => [r.name, r.qty, Math.round(r.revenue)])));
  }

  if (data.inventory.length) {
    sections.push(`<h2>استهلاك المخزون</h2>` + table(['المادة', 'الوحدة', 'الكمية المستهلكة'],
      data.inventory.map(r => [r.name, r.unit, r.total])));
  }

  if (data.orderItems.length) {
    sections.push(`<h2>الطلبات</h2>` + table(
      ['رقم الطلب', 'التاريخ', 'نوع الطلب', 'رقم الطاولة', 'الزبون', 'الهاتف', 'العنوان', 'ملاحظة', 'الصنف', 'الكمية', 'سعر الوحدة (د.ع)', 'إجمالي الصنف (د.ع)', 'مجموع المشتريات (د.ع)', 'رسوم التوصيل (د.ع)', 'الخصم (د.ع)', 'كود الكوبون', 'الإجمالي المدفوع (د.ع)'],
      data.orderItems.map(o => [o.orderId, o.createdAt, o.orderTypeLabel, o.tableNumber, o.clientName, o.clientPhone, o.address, o.note, o.itemName, o.qty, o.unitPrice, o.lineTotal, o.subtotal, o.deliveryFee, o.discountAmount, o.couponCode, o.orderTotal])));
  }

  const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>إحصائيات</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Arial, sans-serif; direction: rtl; text-align: right; }
  h1 { font-size: 20pt; }
  h2 { font-size: 14pt; margin-top: 24px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: right; font-size: 10.5pt; }
  th { background-color: #f1f5f9; font-weight: bold; }
</style>
</head>
<body>${sections.join('\n')}</body>
</html>`;

  downloadBlob(new Blob(['﻿' + html], { type: 'application/msword;charset=utf-8' }),
    `إحصائيات_${periodLabel(data)}.doc`);
}
