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
  // Opcionales: título y subtítulo que van arriba de la fila de grupos
  // (ej. Saldos: 'BANCOS Y CAJA CHICA' / 'NOVIEMBRE 2026') y los índices
  // dentro de rows que van en negrita (ej. TOTALES, SALDO ANTERIOR, SALDO FINAL).
  titulo?: string;
  subtitulo?: string;
  filasNegrita?: number[];
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
  // Columnas congeladas: las 3 primeras (en Activos: No, Maquinaria/Vehículo,
  // Nombre; en Saldos: No, FECHA, CONCEPTO).
  const CONGELADAS = 3;
  // Filas de título opcionales arriba de la fila de grupos.
  const nTitulo = (payload.titulo ? 1 : 0) + (payload.subtitulo ? 1 : 0);
  const filaGrupos = nTitulo;
  const filaHeaders = nTitulo + 1;
  const filaDatos = nTitulo + 2;

  // Fila 1: títulos de grupo (solo el texto en la primera columna del grupo)
  const filaGruposValores: (string | number)[] = new Array(nCols).fill('');
  payload.grupos.forEach((g) => {
    filaGruposValores[g.desde] = g.titulo;
  });
  const valores: (string | number)[][] = [
    ...(payload.titulo ? [[payload.titulo, ...new Array(nCols - 1).fill('')]] : []),
    ...(payload.subtitulo ? [[payload.subtitulo, ...new Array(nCols - 1).fill('')]] : []),
    filaGruposValores,
    payload.headers,
    ...payload.rows,
  ];

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

  // Combinar las filas de título en todo lo ancho. Como cruzan el límite
  // del congelado (columna 3), se parten en dos con la misma lógica de los
  // grupos; el texto queda en la parte congelada.
  for (let t = 0; t < nTitulo; t++) {
    const partes: [number, number][] =
      nCols > CONGELADAS ? [[0, CONGELADAS], [CONGELADAS, nCols]] : [[0, nCols]];
    partes.forEach(([desde, hasta]) => {
      requests.push({
        mergeCells: {
          range: { sheetId: hojaId, startRowIndex: t, endRowIndex: t + 1, startColumnIndex: desde, endColumnIndex: hasta },
          mergeType: 'MERGE_ALL',
        },
      });
    });
  }

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
          range: { sheetId: hojaId, startRowIndex: filaGrupos, endRowIndex: filaGrupos + 1, startColumnIndex: desde, endColumnIndex: hasta },
          mergeType: 'MERGE_ALL',
        },
      });
    });
  });

  // Filas de título (título 14 en negrita, subtítulo 12 en negrita, centrados)
  if (payload.titulo) {
    requests.push({
      repeatCell: {
        range: { sheetId: hojaId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: nCols },
        cell: {
          userEnteredFormat: {
            textFormat: { foregroundColor: TEXTO, fontSize: 14, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)',
      },
    });
  }
  if (payload.subtitulo) {
    requests.push({
      repeatCell: {
        range: { sheetId: hojaId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: nCols },
        cell: {
          userEnteredFormat: {
            textFormat: { foregroundColor: TEXTO, fontSize: 12, bold: true },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          },
        },
        fields: 'userEnteredFormat(textFormat,horizontalAlignment,verticalAlignment)',
      },
    });
  }

  // Fila de títulos de grupo (color fuerte, texto blanco, centrado)
  payload.grupos.forEach((g) => {
    requests.push({
      repeatCell: {
        range: { sheetId: hojaId, startRowIndex: filaGrupos, endRowIndex: filaGrupos + 1, startColumnIndex: g.desde, endColumnIndex: g.hasta + 1 },
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

  // Fila de nombres de columna (tinte claro del grupo, negrita, centrado)
  payload.grupos.forEach((g) => {
    requests.push({
      repeatCell: {
        range: { sheetId: hojaId, startRowIndex: filaHeaders, endRowIndex: filaHeaders + 1, startColumnIndex: g.desde, endColumnIndex: g.hasta + 1 },
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
        range: { sheetId: hojaId, startRowIndex: filaDatos, endRowIndex: filaDatos + nDatos, startColumnIndex: 0, endColumnIndex: nCols },
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
            range: { sheetId: hojaId, startRowIndex: filaDatos + r, endRowIndex: filaDatos + r + 1, startColumnIndex: 0, endColumnIndex: nCols },
            cell: { userEnteredFormat: { backgroundColor: GRIS_RENGLON } },
            fields: 'userEnteredFormat.backgroundColor',
          },
        });
      }
    }

    // Renglones en negrita (ej. TOTALES, SALDO ANTERIOR y SALDO FINAL).
    // Se pone el textFormat completo para no perder el tamaño 11 que puso
    // el bloque de datos.
    (payload.filasNegrita || []).forEach((r) => {
      if (r < 0 || r >= nDatos) return;
      requests.push({
        repeatCell: {
          range: { sheetId: hojaId, startRowIndex: filaDatos + r, endRowIndex: filaDatos + r + 1, startColumnIndex: 0, endColumnIndex: nCols },
          cell: { userEnteredFormat: { textFormat: { foregroundColor: TEXTO, fontSize: 11, bold: true } } },
          fields: 'userEnteredFormat.textFormat',
        },
      });
    });

    // Formato $ en las columnas de montos (las celdas de texto como
    // "Financiado en letra" no se tocan: el formato solo afecta números)
    payload.colsMonto.forEach((col) => {
      requests.push({
        repeatCell: {
          range: { sheetId: hojaId, startRowIndex: filaDatos, endRowIndex: filaDatos + nDatos, startColumnIndex: col, endColumnIndex: col + 1 },
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

  // Altos de las filas de encabezado: títulos 29, grupos 29, columnas 40.
  const altos: [number, number][] = [];
  for (let t = 0; t < nTitulo; t++) altos.push([t, 29]);
  altos.push([filaGrupos, 29], [filaHeaders, 40]);
  altos.forEach(([fila, px]) => {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: hojaId, dimension: 'ROWS', startIndex: fila, endIndex: fila + 1 },
        properties: { pixelSize: px },
        fields: 'pixelSize',
      },
    });
  });

  return { valores, requests };
}
