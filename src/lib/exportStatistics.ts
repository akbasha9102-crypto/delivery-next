import ExcelJS from 'exceljs';

export type StatsExportData = {
  fromDate: string;
  toDate: string;
  summary: { ordersCount: number; totalRevenue: number; avgOrder: number };
  byOrderType: { name: string; count: number; revenue: number }[];
  byCategory: { name: string; count: number; revenue: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  inventory: { name: string; unit: string; total: number }[];
  inventoryDetail: { itemName: string; unit: string; orderClient: string; qty: number; time: string }[];
  orderItems: {
    orderId: string;
    createdAt: string;
    clientName: string;
    clientPhone: string;
    address: string;
    note: string;
    itemName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
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
  return data.fromDate === data.toDate ? data.fromDate : `${data.fromDate}_إلى_${data.toDate}`;
}

export async function exportStatisticsToExcel(data: StatsExportData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'الداشبورد';
  wb.created = new Date();

  const addSheet = (name: string, headers: string[], rows: (string | number)[][]) => {
    const sheet = wb.addWorksheet(name, { views: [{ rightToLeft: true }] });
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { horizontal: 'center' };
    rows.forEach(r => sheet.addRow(r));
    sheet.columns.forEach(col => {
      let max = 12;
      col.eachCell?.({ includeEmpty: true }, cell => {
        const len = String(cell.value ?? '').length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 60);
      col.alignment = { horizontal: 'right', vertical: 'middle' };
    });
    return sheet;
  };

  addSheet('ملخص', ['البيان', 'القيمة'], [
    ['الفترة من', data.fromDate],
    ['الفترة إلى', data.toDate],
    ['عدد الطلبات المكتملة', data.summary.ordersCount],
    ['إجمالي الإيراد (د.ع)', data.summary.totalRevenue],
    ['متوسط الطلب (د.ع)', data.summary.avgOrder],
  ]);

  if (data.byOrderType.length) {
    addSheet('حسب نوع الطلب', ['النوع', 'عدد الطلبات', 'الإيراد (د.ع)'],
      data.byOrderType.map(r => [r.name, r.count, r.revenue]));
  }

  if (data.byCategory.length) {
    addSheet('حسب القسم', ['القسم', 'عدد الطلبات', 'الإيراد (د.ع)'],
      data.byCategory.map(r => [r.name, r.count, Math.round(r.revenue)]));
  }

  if (data.topItems.length) {
    addSheet('الأصناف الأكثر مبيعاً', ['الصنف', 'الكمية المباعة', 'الإيراد (د.ع)'],
      data.topItems.map(r => [r.name, r.qty, Math.round(r.revenue)]));
  }

  if (data.inventory.length) {
    addSheet('المخزون', ['المادة', 'الوحدة', 'الكمية المستهلكة'],
      data.inventory.map(r => [r.name, r.unit, r.total]));
  }

  if (data.inventoryDetail.length) {
    addSheet('تفصيل استهلاك المخزون', ['المادة', 'الطلب', 'الكمية', 'التاريخ'],
      data.inventoryDetail.map(r => [r.itemName, r.orderClient, r.qty, r.time]));
  }

  if (data.orderItems.length) {
    addSheet('الطلبات', ['رقم الطلب', 'التاريخ', 'الزبون', 'الهاتف', 'العنوان', 'ملاحظة', 'الصنف', 'الكمية', 'سعر الوحدة (د.ع)', 'إجمالي الصنف (د.ع)', 'إجمالي الطلب (د.ع)'],
      data.orderItems.map(o => [o.orderId, o.createdAt, o.clientName, o.clientPhone, o.address, o.note, o.itemName, o.qty, o.unitPrice, o.lineTotal, o.orderTotal]));
  }

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `إحصائيات_${periodLabel(data)}.xlsx`);
}

function table(headers: string[], rows: (string | number)[][]) {
  const head = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const body = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

export function exportStatisticsToWord(data: StatsExportData) {
  const sections: string[] = [];

  sections.push(`<h1>تقرير الإحصائيات</h1><p>الفترة: من ${data.fromDate} إلى ${data.toDate}</p>`);

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
    sections.push(`<h2>الطلبات</h2>` + table(['رقم الطلب', 'التاريخ', 'الزبون', 'الهاتف', 'العنوان', 'ملاحظة', 'الصنف', 'الكمية', 'سعر الوحدة (د.ع)', 'إجمالي الصنف (د.ع)', 'إجمالي الطلب (د.ع)'],
      data.orderItems.map(o => [o.orderId, o.createdAt, o.clientName, o.clientPhone, o.address, o.note, o.itemName, o.qty, o.unitPrice, o.lineTotal, o.orderTotal])));
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
