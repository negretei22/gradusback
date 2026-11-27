// Construcción de las peticiones a la API de Google Sheets para escribir el
// reporte de maquinaria. Funciones puras (sin NestJS ni red) para poder
// probarlas sin credenciales.
//
// El reporte es el mismo del Excel que descarga el front: fila 1 con los
// títulos de grupo (combinados, color fuerte, texto blanco), fila 2 con los
// nombres de columna (tinte claro del grupo) y luego los datos, con formato
// $ en las columnas de montos y renglón sí / renglón no en gris claro.
import type { sheets_v4 } from 'googleapis';

export interface GrupoReporte {
  titulo: string;
  desde: number;
  hasta: number;
  color: string; // ARGB 'FF1F4E79' como en el Excel
  claro: string; // ARGB del tinte claro
}

export interface ReporteDrivePayload {
  headers: string[];
  rows: (string | number)[][];
  grupos: GrupoReporte[];
  colsMonto: number[];
  anchos: number[]; // anchos wch como en el Excel
}

// 'FF1F4E79' -> { red: 0.12, green: 0.31, blue: 0.47 }
export function hexArgbAColor(argb: string): { red: number; green: number; blue: number } {
  const hex = argb.replace(/^FF/i, '');
  const n = parseInt(hex, 16);
  const redondea = (v: number) => Math.round(v * 100) / 100;
  return {
    red: redondea(((n >> 16) & 255) / 255),
    green: redondea(((n >> 8) & 255) / 255),
    blue: redondea((n & 255) / 255),
  };
}

const GRIS_BORDE = { red: 0.75, green: 0.75, blue: 0.75 }; // #BFBFBF
const GRIS_RENGLON = { red: 0.95, green: 0.95, blue: 0.95 }; // #F2F2F2
const TEXTO = { red: 0.12, green: 0.12, blue: 0.12 }; // #1F1F1F
const BLANCO = { red: 1, green: 1, blue: 1 };

// Borde fino: en la API de Sheets el estilo se llama 'SOLID' (línea
// sólida de 1px, igual que el THIN del Excel). 'THIN' NO existe en el
// enum de Sheets (NONE, DOTTED, DASHED, SOLID, SOLID_MEDIUM, SOLID_THICK,
// DOUBLE) y la API rechaza todo el batch con "Invalid value ... THIN".
const bordeFino = {
  top: { style: 'SOLID', color: GRIS_BORDE },
  bottom: { style: 'SOLID', color: GRIS_BORDE },
  left: { style: 'SOLID', color: GRIS_BORDE },
  right: { style: 'SOLID', color: GRIS_BORDE },
};

const sinBorde = {
  top: { style: 'NONE' },
  bottom: { style: 'NONE' },
  left: { style: 'NONE' },
  right: { style: 'NONE' },
};

export function construirPeticionesSheets(
  payload: ReporteDrivePayload,
  hojaId: number,
): { valores: (string | number)[][]; requests: sheets_v4.Schema$Request[] } {
  const nCols = payload.headers.length;
  const nDatos = payload.rows.length;
  // Columnas congeladas: No, Maquinaria/Vehículo, Nombre.
  const CONGELADAS = 3;

  // Fila 1: títulos de grupo (solo el texto en la primera columna del grupo)
  const filaGrupos: (string | number)[] = new Array(nCols).fill('');
  payload.grupos.forEach((g) => {
    filaGrupos[g.desde] = g.titulo;
  });
  const valores: (string | number)[][] = [filaGrupos, payload.headers, ...payload.rows];

  const requests: sheets_v4.Schema$Request[] = [];

  // Quitar combinaciones viejas de exportaciones anteriores (si el reporte
  // nuevo trae menos columnas, no quedan títulos fantasma).
  requests.push({
    unmergeCells: {
      range: { sheetId: hojaId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 26 },
    },
  });

  // Reset de formato en la zona que se va a escribir (quita rellenos y
  // bordes viejos de exportaciones anteriores; el formato nuevo se aplica
  // después, en este mismo batch).
  requests.push({
    repeatCell: {
      range: { sheetId: hojaId, startRowIndex: 0, endRowIndex: 200, startColumnIndex: 0, endColumnIndex: 26 },
      cell: {
        userEnteredFormat: {
          backgroundColor: BLANCO,
          textFormat: { foregroundColor: TEXTO, fontSize: 11 },
          borders: sinBorde,
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat,borders)',
    },
  });

  // Congelar las primeras 3 columnas (No, Maquinaria/Vehículo, Nombre)
  // para ver siempre de qué vehículo o maquinaria es cada renglón al
  // moverse a la derecha. En el Excel descargado no se puede (la librería
  // xlsx-js-style no escribe el congelado); en la hoja de Drive sí.
  requests.push({
    updateSheetProperties: {
      properties: {
        sheetId: hojaId,
        gridProperties: { frozenColumnCount: CONGELADAS },
      },
      fields: 'gridProperties.frozenColumnCount',
    },
  });

  // Combinar la fila de títulos por grupo. Google NO permite combinar
  // columnas congeladas con no congeladas: si un grupo cruza el límite
  // (columna 3), se parte en dos combinaciones con el mismo formato; el
  // título queda en la primera celda del grupo (parte congelada, así
  // sigue visible al moverse a la derecha).
  payload.grupos.forEach((g) => {
    const cruza = g.desde < CONGELADAS && g.hasta + 1 > CONGELADAS;
    const partes = cruza
      ? [[g.desde, CONGELADAS], [CONGELADAS, g.hasta + 1]]
      : [[g.desde, g.hasta + 1]];
    partes.forEach(([desde, hasta]) => {
      requests.push({
        mergeCells: {
          range: { sheetId: hojaId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: desde, endColumnIndex: hasta },
          mergeType: 'MERGE_ALL',
        },
      });
    });
  });

  // Fila 1: títulos de grupo (color fuerte, texto blanco, centrado)
  payload.grupos.forEach((g) => {
    requests.push({
      repeatCell: {
        range: { sheetId: hojaId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: g.desde, endColumnIndex: g.hasta + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexArgbAColor(g.color),
            textFormat: { foregroundColor: BLANCO, fontSize: 12, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            borders: bordeFino,
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,borders)',
      },
    });
  });

  // Fila 2: nombres de columna (tinte claro del grupo, negrita, centrado)
  payload.grupos.forEach((g) => {
    requests.push({
      repeatCell: {
        range: { sheetId: hojaId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: g.desde, endColumnIndex: g.hasta + 1 },
        cell: {
          userEnteredFormat: {
            backgroundColor: hexArgbAColor(g.claro),
            textFormat: { foregroundColor: TEXTO, fontSize: 11, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP',
            borders: bordeFino,
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy,borders)',
      },
    });
  });

  if (nDatos > 0) {
    // Datos: bordes finos y texto 11 en todo el bloque
    requests.push({
      repeatCell: {
        range: { sheetId: hojaId, startRowIndex: 2, endRowIndex: 2 + nDatos, startColumnIndex: 0, endColumnIndex: nCols },
        cell: {
          userEnteredFormat: {
            textFormat: { foregroundColor: TEXTO, fontSize: 11 },
            verticalAlignment: 'MIDDLE',
            borders: bordeFino,
          },
        },
        fields: 'userEnteredFormat(textFormat,verticalAlignment,borders)',
      },
    });

    // Renglón sí / renglón no en gris claro (igual que el Excel)
    for (let r = 0; r < nDatos; r++) {
      if (r % 2 === 1) {
        requests.push({
          repeatCell: {
            range: { sheetId: hojaId, startRowIndex: 2 + r, endRowIndex: 3 + r, startColumnIndex: 0, endColumnIndex: nCols },
            cell: { userEnteredFormat: { backgroundColor: GRIS_RENGLON } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        });
      }
    }

    // Formato $ en las columnas de montos (las celdas de texto como
    // "Financiado en letra" no se tocan: el formato solo afecta números)
    payload.colsMonto.forEach((col) => {
      requests.push({
        repeatCell: {
          range: { sheetId: hojaId, startRowIndex: 2, endRowIndex: 2 + nDatos, startColumnIndex: col, endColumnIndex: col + 1 },
          cell: { userEnteredFormat: { numberFormat: { type: 'CURRENCY', pattern: '"$"#,##0.00' } } },
          fields: 'userEnteredFormat.numberFormat',
        },
      });
    });
  }

  // Anchos de columna (wch del Excel -> píxeles aprox.)
  payload.anchos.forEach((wch, i) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: hojaId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize: Math.round(wch * 7 + 5) },
        fields: 'pixelSize',
      },
    });
  });

  // Altos de las dos filas de encabezado (22 y 30 puntos del Excel)
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: hojaId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
      properties: { pixelSize: 29 },
      fields: 'pixelSize',
    },
  });
  requests.push({
    updateDimensionProperties: {
      range: { sheetId: hojaId, dimension: 'ROWS', startIndex: 1, endIndex: 2 },
      properties: { pixelSize: 40 },
      fields: 'pixelSize',
    },
  });

  return { valores, requests };
}
