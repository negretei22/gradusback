import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as Papa from 'papaparse';


@Injectable()
export class CajaChicaService {

  constructor(@InjectDataSource() private dataSource: DataSource) { }

  private cache: { data: any[]; ts: number } | null = null;
  private readonly TTL_MS = 30_000;

  // "$1,234.50" -> 1234.5 | "($50.00)" o "-$50" -> -50
  private aNumero(v: string): number {
    const s = (v ?? '').trim();
    if (!s) return 0;
    const neg = /^\(.*\)$/.test(s) || s.startsWith('-');
    const n = parseFloat(s.replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : (neg ? -n : n);
  }

  // dd/MM/yyyy -> yyyy-MM-dd
  private aFecha(v: string): string {
    const s = (v ?? '').trim().toLowerCase();

    // 01-ene-2026
    const meses: Record<string, string> = {
      ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06',
      jul: '07', ago: '08', sep: '09', set: '09', oct: '10', nov: '11', dic: '12',
    };
    let m = s.match(/^(\d{1,2})[-\/ ]([a-záéíóú]{3})[a-z]*\.?[-\/ ](\d{4})$/);
    if (m && meses[m[2]]) return `${m[3]}-${meses[m[2]]}-${m[1].padStart(2, '0')}`;

    // dd/MM/yyyy
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;

    // yyyy-MM-dd
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;

    return '';
  }


  async leerTodo(gid: string = process.env.SHEET_GID!): Promise<any[]> {
    /*if (this.cache && Date.now() - this.cache.ts < this.TTL_MS) {
      return this.cache.data;
    }*/



    const url = `https://docs.google.com/spreadsheets/d/${process.env.SHEET_ID}/export?format=csv&gid=${gid}`;

    const resp = await fetch(url);

    if (!resp.ok) {
      throw new Error(`No se pudo leer el Sheet (${resp.status})`);
    }

    const csv = await resp.text();

    const filas = Papa.parse<string[]>(csv, {
      skipEmptyLines: false,
    }).data;

    console.log('GID:', gid);
    console.log('URL:', url);
    console.log('PRIMERAS FILAS:', JSON.stringify(filas.slice(0, 10), null, 2));
    console.log('FECHAS ORIGINALES:', filas.slice(0, 10).map(r => r[0]));
    console.log('FECHAS CONVERTIDAS:', filas.slice(0, 10).map(r => this.aFecha(r[0])));

    const esPrimeraHoja = gid === '428204613';

    const columnas = esPrimeraHoja
      ? {
        numero: 0,
        fecha: 1,
        aplicado_a: 2,
        concepto: 3,
        gasto: 4,
        ingreso: 5,
        saldo: 6,
      }
      : {
        numero: 0,
        fecha: 1,
        aplicado_a: -1,
        concepto: 2,
        gasto: 3,
        ingreso: 4,
        saldo: 5,
      };

    let running = 0;

    const data = filas
      .map((r, i) => ({ r, fila: i + 1 }))
      .filter(({ r }) =>
        /^\d+$/.test((r[columnas.numero] ?? '').trim()) &&
        this.aFecha(r[columnas.fecha]) !== ''
      )
      .map(({ r, fila }, idx) => {
        const gasto = this.aNumero(r[columnas.gasto]);
        const ingreso = this.aNumero(r[columnas.ingreso]);

        running += ingreso - gasto;

        return {
          id: fila,
          fecha: this.aFecha(r[columnas.fecha]),

          aplicado_a:
            columnas.aplicado_a >= 0
              ? r[columnas.aplicado_a] ?? ''
              : '',

          concepto: (r[columnas.concepto] ?? '').toUpperCase(),

          gasto,
          ingreso,

          saldo_actual: r[columnas.saldo]?.trim()
            ? this.aNumero(r[columnas.saldo])
            : running,

          capturo: 'VICKY',

          orden: idx + 1,
        };
      });

    this.cache = { data, ts: Date.now() };

    return data;
  }


  // Marca cada gasto que ya existe en movimientos_financieros
  private async marcarMovimientosFinancieros(movs: any[]): Promise<any[]> {
    const gastos = movs.filter(m => m.gasto > 0);
    if (!gastos.length) {
      return movs.map(m => ({ ...m, tiene_movimiento: false, movimiento_financiero_id: null }));
    }

    const fechas = gastos.map(m => m.fecha).sort();
    const desde = fechas[0];
    const hasta = fechas[fechas.length - 1];

    const filas: any[] = await this.dataSource.query(
      `SELECT id,
            DATE_FORMAT(fecha_pago, '%Y-%m-%d')    AS fecha_pago,
            DATE_FORMAT(fecha_factura, '%Y-%m-%d') AS fecha_factura,
            importe_sin_iva
     FROM movimientos_financieros
     WHERE (fecha_pago BETWEEN ? AND ? OR fecha_factura BETWEEN ? AND ?)`,
      [desde, hasta, desde, hasta],
    );

    // índice: "fecha|monto" -> id del movimiento financiero
    const indice = new Map<string, number>();
    for (const f of filas) {
      const monto = Number(f.importe_sin_iva).toFixed(2);
      for (const fecha of [f.fecha_pago, f.fecha_factura]) {
        if (fecha) {
          const key = `${fecha}|${monto}`;
          if (!indice.has(key)) indice.set(key, f.id);
        }
      }
    }

    return movs.map(m => {
      const id = m.gasto > 0 ? indice.get(`${m.fecha}|${m.gasto.toFixed(2)}`) : undefined;
      return { ...m, tiene_movimiento: id !== undefined, movimiento_financiero_id: id ?? null };
    });
  }

  private delPeriodo(todos: any[], anio: number, mes: number) {
    return todos.filter(m => {
      const [y, mm] = m.fecha.split('-').map(Number);
      return y === Number(anio) && (!Number(mes) || mm === Number(mes));
    });
  }

  async findMovimientos(anio?: string, mes?: string) {

    const todos = await this.leerTodo();
    const lista = anio ? this.delPeriodo(todos, Number(anio), Number(mes)) : todos;
    return this.marcarMovimientosFinancieros(lista);
  }

  async getSaldo(anio: number, mes: number) {
    const todos = await this.leerTodo();
    const periodo = this.delPeriodo(todos, anio, mes);
    return {
      total_gasto: periodo.reduce((s, m) => s + m.gasto, 0),
      total_ingreso: periodo.reduce((s, m) => s + m.ingreso, 0),
      saldo_actual: todos.length ? todos[todos.length - 1].saldo_actual : 0,
    };
  }

  async getMovimientoFinanciero(id: number) {
    const filas: any[] = await this.dataSource.query(
      `SELECT m.*,
            DATE_FORMAT(m.fecha_pago, '%Y-%m-%d')    AS fecha_pago_txt,
            DATE_FORMAT(m.fecha_factura, '%Y-%m-%d') AS fecha_factura_txt
     FROM movimientos_financieros m
     WHERE m.id = ?`,
      [Number(id)],
    );
    return filas[0] ?? null;
  }

  async getMovimiento(id: number) {
    return (await this.leerTodo()).find(m => m.id === Number(id)) ?? null;
  }
}