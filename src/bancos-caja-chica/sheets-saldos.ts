// Constructor del archivo de Saldos en Drive (Bancos y Caja Chica):
// el mismo reporte del Excel que descarga el front (10 columnas, grupos
// BANORTE y CAJA CHICA, totales, saldo anterior, movimientos y saldo final).
// Función pura (sin NestJS ni red) para poder probarla sin credenciales.
import type { ReporteDrivePayload } from '../maquinaria/sheets-reporte';

const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// Fecha yyyy-MM-dd -> dd-mmm-yyyy (igual que el Excel del front).
function fmtFecha(f: string): string {
  if (!f) return '';
  const partes = String(f).split('T')[0].split(' ')[0].split('-');
  if (partes.length !== 3) return String(f);
  const [y, m, d] = partes;
  return `${d}-${MESES_ABR[Number(m) - 1] || m}-${y}`;
}

// Monto redondeado a pesos enteros (igual que el Excel con centavos
// apagados, que es la vista por default). El 0 en gasto/ingreso va vacío.
function redondear(n: any): number {
  return Math.round(Number(n) || 0);
}
function vacioSiCero(n: any): number | string {
  const r = redondear(n);
  return r === 0 ? '' : r;
}

export function construirPayloadSaldos(
  datos: {
    saldo_anterior: { banco_gasto: number; banco_ingreso: number; caja_gasto: number; caja_ingreso: number };
    movimientos: any[];
    totales: { banco_gasto: number; banco_ingreso: number; caja_gasto: number; caja_ingreso: number };
    saldo_final: { banco: number; caja: number };
  },
  nombreMes: string,
  anio: number,
): ReporteDrivePayload {
  const sa = datos.saldo_anterior;
  const t = datos.totales;
  const sf = datos.saldo_final;

  const rows: (string | number)[][] = [
    ['', '', 'TOTALES:', redondear(t.banco_gasto), redondear(t.banco_ingreso), '', redondear(t.caja_gasto), redondear(t.caja_ingreso), '', ''],
    ['', '', 'SALDO ANTERIOR', redondear(sa.banco_gasto), redondear(sa.banco_ingreso), '', redondear(sa.caja_gasto), redondear(sa.caja_ingreso), '', ''],
    ...datos.movimientos.map((m: any, i: number) => [
      i + 1,
      fmtFecha(m.fecha),
      m.concepto,
      vacioSiCero(m.banco_gasto),
      vacioSiCero(m.banco_ingreso),
      redondear(m.saldo_banco),
      vacioSiCero(m.caja_gasto),
      vacioSiCero(m.caja_ingreso),
      redondear(m.saldo_caja),
      m.forma_pago || '',
    ]),
    ['', '', 'SALDO FINAL', '', '', redondear(sf.banco), '', '', redondear(sf.caja), ''],
  ];

  // Grupos sin título (gris) para que el encabezado lleve el gris del
  // Excel también en No/FECHA/CONCEPTO y en Forma de pago, que no son ni
  // Banorte ni Caja Chica.
  const GRIS = { color: 'FF808080', claro: 'FFEEEEEE' };
  return {
    titulo: 'BANCOS Y CAJA CHICA',
    subtitulo: `${nombreMes} ${anio}`,
    headers: ['No.', 'FECHA', 'CONCEPTO', 'Gasto (-)', 'Ingreso (+)', 'SALDO', 'Gasto (-)', 'Ingreso (+)', 'SALDO', 'Forma de pago'],
    rows,
    grupos: [
      { titulo: '', desde: 0, hasta: 2, ...GRIS },
      { titulo: 'BANORTE', desde: 3, hasta: 5, color: 'FF1F4E79', claro: 'FFD9E2F3' },
      { titulo: 'CAJA CHICA', desde: 6, hasta: 8, color: 'FFBF8F00', claro: 'FFFFF2CC' },
      { titulo: '', desde: 9, hasta: 9, ...GRIS },
    ],
    colsMonto: [3, 4, 5, 6, 7, 8],
    anchos: [6, 13, 52, 14, 14, 15, 14, 14, 15, 34],
    filasNegrita: [0, 1, rows.length - 1],
  };
}
