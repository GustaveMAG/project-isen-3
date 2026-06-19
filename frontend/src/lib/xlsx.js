import * as XLSX from 'xlsx';

// Génère et télécharge un classeur Excel (.xlsx) propre, avec un onglet par section.
//
// sheets : [{
//   name: 'Tâches',
//   columns: [{ label: 'Titre', value: 'titre' | (row) => ..., width: 30 }],
//   rows: [...]
// }]
export function downloadXlsx(filename, sheets) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const cell = (col, row) =>
      typeof col.value === 'function' ? col.value(row) : row[col.value];

    const aoa = [
      sheet.columns.map((c) => c.label),
      ...sheet.rows.map((r) => sheet.columns.map((c) => {
        const v = cell(c, r);
        return v === null || v === undefined ? '' : v;
      })),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Largeurs de colonnes (clean)
    ws['!cols'] = sheet.columns.map((c) => ({ wch: c.width || 18 }));
    // Ligne d'en-tête figée
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Nom d'onglet : max 31 car., pas de caractères interdits
    const name = (sheet.name || 'Feuille').replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, name);
  }

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}
