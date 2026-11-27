// Constructores de los 3 archivos de Drive (uno por módulo):
//   Leasing   <- facturas de egreso ligadas al activo (Finanzas)
//   Seguros   <- pólizas (Activos)
//   Servicios <- último servicio por activo (Servicios)
//
// Cada archivo lleva las 3 columnas de identidad (No, Maquinaria/Vehículo,
// Nombre) + su grupo, y las 3 primeras columnas van congeladas. Las reglas
// de formato son las mismas del Excel: dato que falta -> guion, 0 -> guion,
// fechas dd-mmm-aa, $ en las columnas de montos. Funciones puras (sin
// NestJS ni red) para poder probarlas sin credenciales.
import type { GrupoReporte, ReporteDrivePayload } from './sheets-reporte';

export type ArchivoDrive = 'leasing' | 'seguros' | 'servicios';

const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const GUION = '-';

const GRUPO_ACTIVO: GrupoReporte = { titulo: 'DATOS DEL ACTIVO', desde: 0, hasta: 2, color: 'FF1F4E79', claro: 'FFD9E2F3' };
const IDENTIDAD = ['No.', 'MAQUINARIA / VEHÍCULO', 'NOMBRE'];
const ANCHOS_IDENTIDAD = [5, 22, 14];

// Fecha a dd-mmm-aa. La fecha puede llegar como Date (consulta directa) o
// como texto ISO (JSON). En ambos casos se toma la parte de fecha tal como
// la muestra el Excel del front (toISOString es UTC, igual que lo que el
// front recibe serializado), así no hay corrimiento de un día.
export function fmtFecha(f: any): string {
  if (!f) return GUION;
  let soloFecha = '';
  if (f instanceof Date) {
    if (isNaN(f.getTime())) return GUION;
    soloFecha = f.toISOString().slice(0, 10);
  } else {
    soloFecha = String(f).split('T')[0].split(' ')[0];
  }
  const partes = soloFecha.split('-');
  if (partes.length !== 3) return soloFecha;
  const [y, m, d] = partes;
  return `${d}-${MESES_ABR[Number(m) - 1] || m}-${y.slice(2)}`;
}

// Monto como número para la hoja (guion si no aplica); el formato $ se pone
// en la celda. Si el valor es texto no numérico (ej. "Financiado en letra")
// se deja el texto tal cual. El 0 es el valor por default cuando no se
// capturó nada, así que también es guion.
export function montoCelda(v: any): number | string {
  if (v === null || v === undefined || v === '') return GUION;
  const n = Number(v);
  if (isFinite(n)) return n === 0 ? GUION : n;
  const t = String(v).trim();
  return t || GUION;
}

function fmtHrsKm(c: any): string {
  const num = (v: any): string => {
    const n = Number(v);
    return isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '';
  };
  const h = Number(c.ultimo_horometro_servicio);
  if (isFinite(h) && h !== 0) return `${num(c.ultimo_horometro_servicio)} HR`;
  const k = Number(c.ultimo_kilometraje);
  if (isFinite(k) && k !== 0) return `${num(c.ultimo_kilometraje)} kms`;
  return GUION;
}

function fmtTipoServicio(c: any): string {
  const prog = c.ultimo_servicio_programado;
  const n = Number(prog);
  if (prog !== null && prog !== undefined && prog !== '' && isFinite(n) && n !== 0) {
    const valor = String(n);
    const unidad = (c.ultimo_unidad_servicio || '').trim();
    return unidad ? `${valor} ${unidad}` : `${valor}`;
  }
  return (c.ultimo_comentarios || '').trim() || GUION;
}

function fmtAseguradora(c: any): string {
  if ((c.aseguradora || '').trim()) return c.aseguradora;
  if ((c.numero_poliza || '').trim()) return GUION;
  return 'No Asegurado';
}

function identidad(c: any, i: number): (string | number)[] {
  return [i + 1, c.tipo_maquinaria || GUION, c.nombre || GUION];
}

// ---------------- Seguros: un renglón por activo ----------------
export function construirPayloadSeguros(lista: any[]): ReporteDrivePayload {
  const headers = [
    ...IDENTIDAD,
    'ASEGURADORA',
    'NO. PÓLIZA DE SEGURO',
    'FECHA DE INICIO',
    'FECHA DE TÉRMINO',
    'COSTO DE LA PÓLIZA (PRECIOS INCLUYEN IVA)',
  ];
  const rows = lista.map((c: any, i: number) => [
    ...identidad(c, i),
    fmtAseguradora(c),
    c.numero_poliza || GUION,
    fmtFecha(c.fecha_inicio_poliza),
    fmtFecha(c.fecha_fin_poliza),
    montoCelda(c.costo_poliza),
  ]);
  return {
    headers,
    rows,
    grupos: [
      GRUPO_ACTIVO,
      { titulo: 'DATOS DEL SEGURO', desde: 3, hasta: 7, color: 'FFBF8F00', claro: 'FFFFF2CC' },
    ],
    colsMonto: [7],
    anchos: [...ANCHOS_IDENTIDAD, 18, 18, 14, 14, 20],
  };
}

// ---------------- Servicios: un renglón por activo (último servicio) ----------------
export function construirPayloadServicios(lista: any[]): ReporteDrivePayload {
  const headers = [
    ...IDENTIDAD,
    'TIPO DE SERVICIO',
    'FECHA ÚLTIMO SERVICIO',
    'HRS O KM AL ÚLTIMO SERVICIO',
  ];
  const rows = lista.map((c: any, i: number) => [
    ...identidad(c, i),
    fmtTipoServicio(c),
    fmtFecha(c.ultimo_fecha_servicio),
    fmtHrsKm(c),
  ]);
  return {
    headers,
    rows,
    grupos: [
      GRUPO_ACTIVO,
      { titulo: 'DATOS DEL SERVICIO', desde: 3, hasta: 5, color: 'FF548235', claro: 'FFE2EFDA' },
    ],
    colsMonto: [],
    anchos: [...ANCHOS_IDENTIDAD, 18, 14, 16],
  };
}

// ---------------- Leasing: un renglón por activo de Leasing ----------------
// pagosPorActivo: por id_maquinaria, lo que suman las facturas de egreso
// ligadas a ese activo (movimientos_financieros.activo_maquinaria_id).
export interface PagosActivo {
  pagos: number; // renglones ligados
  maxNumero: number; // mayor numero_pago (0 si no hay)
  totalPagado: number; // suma de gran_total
  ultimoPago: any; // fecha_pago máxima (Date o texto ISO)
}

export function construirPayloadLeasing(
  lista: any[],
  pagosPorActivo: Map<number, PagosActivo>,
): ReporteDrivePayload {
  const headers = [
    ...IDENTIDAD,
    'VALOR TOTAL (PRECIOS INCLUYEN IVA)',
    'PAGO MENSUAL (PRECIOS INCLUYEN IVA)',
    'PLAZO (PAGOS)',
    'PAGOS HECHOS',
    'PAGOS PENDIENTES',
    'TOTAL PAGADO (PRECIOS INCLUYEN IVA)',
    'POR PAGAR (PRECIOS INCLUYEN IVA)',
    'FECHA ÚLTIMO PAGO',
  ];
  const soloLeasing = lista.filter((c: any) => Number(c.id_tipo_de_adquisicion) === 2);
  const rows = soloLeasing.map((c: any, i: number) => {
    // Pago mensual: la renta mensual manda cuando existe (igual que el Excel).
    const pagoMensual =
      c.monto_renta_mensual !== null && c.monto_renta_mensual !== undefined && c.monto_renta_mensual !== ''
        ? c.monto_renta_mensual
        : c.pago_mensual;
    const pagoMensualNum = Number(pagoMensual);
    const plazoNum = Number(c.plazo);
    const p = pagosPorActivo.get(Number(c.id_maquinaria)) || {
      pagos: 0,
      maxNumero: 0,
      totalPagado: 0,
      ultimoPago: null,
    };
    // Pagos hechos: el mayor numero_pago cuando hay folios; si no, el conteo
    // (misma regla del modal $ de Activos).
    const hechos = p.maxNumero > 0 ? p.maxNumero : p.pagos;
    const pendientes = plazoNum > 0 ? Math.max(plazoNum - hechos, 0) : null;
    const porPagar =
      pendientes !== null && isFinite(pagoMensualNum) && pagoMensualNum !== 0
        ? pendientes * pagoMensualNum
        : null;
    return [
      ...identidad(c, i),
      montoCelda(c.valor_compra),
      montoCelda(pagoMensual),
      plazoNum > 0 ? plazoNum : GUION,
      hechos,
      pendientes !== null ? pendientes : GUION,
      montoCelda(p.totalPagado),
      montoCelda(porPagar),
      fmtFecha(p.ultimoPago),
    ];
  });
  return {
    headers,
    rows,
    grupos: [
      GRUPO_ACTIVO,
      { titulo: 'DATOS DEL LEASING', desde: 3, hasta: 10, color: 'FF2E75B6', claro: 'FFDDEBF7' },
    ],
    colsMonto: [3, 4, 8, 9],
    anchos: [...ANCHOS_IDENTIDAD, 20, 20, 12, 12, 14, 20, 20, 16],
  };
}
