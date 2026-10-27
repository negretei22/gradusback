import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

const MESES: Record<string, number> = {
    ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
    JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
};

export interface MovimientoBanco {
    fecha: string;
    descripcion: string;
    monto: number;
    saldo: number;
    tipo: 'cargo' | 'abono' | null;
}

export interface MovimientoSistema {
    id: number;
    fecha: string;
    concepto: string;
    razon_social: string;
    tipo_movimiento_id: number | string;
    metodo_pago_id: number | string;
    importe_sin_iva: number | string;
    iva_acreditable: number | string;
    monto: number | string;
    monto_con_iva: number | string;
}

@Injectable()
export class ConciliacionService {

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }



    private detectarTipoMovimiento(
        descripcion: string,
        tipoPorSaldo: 'cargo' | 'abono' | null
    ): 'cargo' | 'abono' | null {

        const texto = descripcion
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();

        // INGRESOS
        if (
            /\bSPEI RECIBIDO\b/.test(texto) ||
            /\bDE LA CUENTA\b/.test(texto)
        ) {
            return 'abono';
        }

        // EGRESOS
        if (
            /\bTRASPASO A CUENTA\b/.test(texto) ||
            /\bSPEI ENVIADO\b/.test(texto)
        ) {
            return 'cargo';
        }

        // Si no coincide ninguna descripción,
        // utilizar el cambio de saldo.
        return tipoPorSaldo;
    }

    // ============================================
    // 1. LEER ESTADO DE CUENTA BANORTE
    // ============================================
    private parsear(texto: string): MovimientoBanco[] {

        const reFecha = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})/;
        const reFin = /^(TOTAL|TOTALES|P[ÁA]GINA|SALDO PROMEDIO|SALDO FINAL|RESUMEN|CADENA ORIGINAL|SELLO|Línea Directa|Banco Mercantil)/i;

        const num = (v: string): number => Number(v.replace(/,/g, ''));
        const pad = (v: number): string => String(v).padStart(2, '0');

        // Cola de la línea: dos importes pegados al final, con decimales .dd
        // Candidatos: "<monto><saldo>" donde cada uno es dinero con coma de miles opcional
        const reDinero = /\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}/g;

        const filas: MovimientoBanco[] = [];

        let inicio = texto.indexOf('DETALLE DE MOVIMIENTOS');
        if (inicio === -1) inicio = 0;
        const lineas = texto.substring(inicio).split('\n');

        const saldoIni = texto.match(/\(Saldo inicial de\s*\$?\s*([\d,]+\.\d{2})\)/i);
        let saldoPrev: number | null = saldoIni ? num(saldoIni[1]) : null;

        // Devuelve todas las lecturas posibles de dinero al final del texto
        // Ej: "01092026150,000.00228,640.77" -> prueba partir en cualquier punto
        const candidatos = (s: string): { monto: number; saldo: number; corte: number }[] => {
            const res: { monto: number; saldo: number; corte: number }[] = [];
            // saldo = el último importe (de derecha a izquierda, con formato válido)
            const m = s.match(/(\d{1,3}(?:,\d{3})*\.\d{2})$/);
            if (!m) return res;
            // posibles saldos: sufijos válidos del final
            const finales: string[] = [];
            const tail = s;
            for (let len = 4; len <= Math.min(14, tail.length); len++) {
                const suf = tail.slice(-len);
                if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(suf)) finales.push(suf);
            }
            for (const saldoStr of finales) {
                const resto = tail.slice(0, tail.length - saldoStr.length);
                for (let len = 4; len <= Math.min(14, resto.length); len++) {
                    const suf = resto.slice(-len);
                    if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(suf)) {
                        res.push({
                            monto: num(suf),
                            saldo: num(saldoStr),
                            corte: resto.length - len,
                        });
                    }
                }
            }
            return res;
        };

        let bloque: string[] = [];

        const procesar = (): void => {
            if (!bloque.length) return;

            const primera = bloque[0];
            const f = primera.match(reFecha);
            if (!f) return;

            const mes = MESES[f[2].toUpperCase()];
            if (!mes) return;
            const dia = Number(f[1]);
            let anio = Number(f[3]);
            if (anio < 100) anio += 2000;
            const fecha = `${anio}-${pad(mes)}-${pad(dia)}`;

            const contenido = bloque.join(' ').replace(/\s+/g, ' ').trim();

            // SALDO ANTERIOR: solo fija el saldo de arranque
            if (/SALDO ANTERIOR/i.test(contenido)) {
                const ds = contenido.match(reDinero);
                if (ds) saldoPrev = num(ds[ds.length - 1]);
                return;
            }

            // El monto y el saldo están pegados al final de la última línea con dinero
            // Buscamos en el texto completo el último tramo que termine en .dd
            const colaMatch = contenido.match(/[\d,]+\.\d{2}(?:[\d,]*\.\d{2})*\s*$/);
            if (!colaMatch) return;
            const cola = colaMatch[0].trim();

            let elegido: { monto: number; saldo: number; corte: number } | null = null;
            let tipo: 'cargo' | 'abono' | null = null;

            if (saldoPrev !== null) {
                for (const c of candidatos(cola)) {
                    if (c.monto <= 0) continue;
                    if (Math.abs(saldoPrev - c.monto - c.saldo) <= 0.02) {
                        elegido = c; tipo = 'cargo'; break;
                    }
                    if (Math.abs(saldoPrev + c.monto - c.saldo) <= 0.02) {
                        elegido = c; tipo = 'abono'; break;
                    }
                }
            }

            if (!elegido) {
                console.warn('⚠️ NO CUADRÓ:', { fecha, saldoPrev, cola, contenido: contenido.substring(0, 160) });
                return;
            }

            saldoPrev = elegido.saldo;

            const posCola = contenido.length - cola.length;
            const descripcion = contenido
                .substring(f[0].length, posCola + elegido.corte)
                .replace(/\s+/g, ' ')
                .trim();


            const tipoDetectado = this.detectarTipoMovimiento(
                descripcion,
                tipo
            );

            if (![500, 80].includes(Math.round(elegido.monto * 100))) {
                filas.push({
                    fecha,
                    descripcion,
                    monto: elegido.monto,
                    saldo: elegido.saldo,
                    tipo: tipoDetectado,
                });
            }

        };

        for (const original of lineas) {
            const linea = original.trim();
            if (!linea) continue;

            if (reFecha.test(linea)) {
                procesar();
                bloque = [linea];
            } else if (reFin.test(linea)) {
                procesar();
                bloque = [];
            } else if (bloque.length) {
                bloque.push(linea);
            }
        }
        procesar();

        return filas;
    }

    // ============================================
    // 2. COMPARAR IMPORTE (sin IVA o con IVA)
    // ============================================
    private coincideImporte(
        banco: MovimientoBanco,
        sistema: MovimientoSistema,
        toleranciaCentavos = 5
    ): boolean {
        const montoBanco = Math.round(Number(banco.monto) * 100);
        const montoSinIva = Math.round(Number(sistema.monto) * 100);
        const montoConIva = Math.round(Number(sistema.monto_con_iva) * 100);

        return (
            Math.abs(montoBanco - montoSinIva) <= toleranciaCentavos ||
            Math.abs(montoBanco - montoConIva) <= toleranciaCentavos
        );
    }
    // ============================================
    // 3. COMPARAR TIPO (cargo = egreso, abono = ingreso)
    // ============================================
    private coincideTipo(banco: MovimientoBanco, sistema: MovimientoSistema): boolean {
        if (!banco.tipo) return true;
        const esEgreso = Number(sistema.tipo_movimiento_id) === 2;
        return banco.tipo === 'cargo' ? esEgreso : !esEgreso;
    }

    // ============================================
    // 4. CONCILIAR
    // ============================================
    async conciliar(buffer: Buffer) {

        const pdf = await pdfParse(buffer);
        const banco = this.parsear(pdf.text);

        if (!banco.length) {
            throw new BadRequestException(
                'No pude leer movimientos en el PDF. Verifica que sea un estado de cuenta Banorte válido.'
            );
        }

        const fechas = banco.map(b => b.fecha).sort();
        const desde = fechas[0];
        const hasta = fechas[fechas.length - 1];
        const mesConsulta = `${desde.substring(0, 7)}-01`;

        const sql = `
    SELECT
        id,
        DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha,
        concepto,
        razon_social,
        tipo_movimiento_id,
        metodo_pago_id,
        importe_sin_iva,
        iva_acreditable,
        importe_sin_iva AS monto,
        (importe_sin_iva + COALESCE(iva_acreditable, 0)) AS monto_con_iva
    FROM movimientos_financieros
    WHERE tipo_movimiento_id IN (1, 2, 4)
      AND metodo_pago_id IN (2, 6)
      AND fecha_pago >= ?
      AND fecha_pago < DATE_ADD(?, INTERVAL 1 MONTH)
    ORDER BY fecha_pago, id
`;

        const params = [mesConsulta, mesConsulta];



        const sistema: MovimientoSistema[] = await this.dataSource.query(sql, params);

        //console.log(sistema)

        const money = (n: number | string) => Number(n).toFixed(2);

        const tipoBanco = (b: MovimientoBanco): 'ingreso' | 'egreso' =>
            b.tipo === 'abono' ? 'ingreso' : 'egreso';

        const tipoSistema = (s: MovimientoSistema): 'ingreso' | 'egreso' =>
            [1, 4].includes(Number(s.tipo_movimiento_id))
                ? 'ingreso'
                : 'egreso';

        const llave = (tipo: string, fecha: string, monto: string) =>
            `${tipo}|${fecha}|${monto}`;

        // Grupos basados en el importe del banco.
        const bancoMap = new Map<string, MovimientoBanco[]>();
        const sistemaMap = new Map<string, MovimientoSistema[]>();

        for (const b of banco) {
            const k = llave(tipoBanco(b), b.fecha, money(b.monto));

            if (!bancoMap.has(k)) bancoMap.set(k, []);
            bancoMap.get(k)!.push(b);
        }

        // Evitar utilizar dos veces un mismo movimiento.
        const sistemaUsados = new Set<number>();
        const bancoUsados = new Set<number>();

        // PRIMERA PASADA: coincidencias exactas.
        // SEGUNDA PASADA: diferencias de hasta 5 centavos.
        for (const tolerancia of [0, 5]) {

            for (let i = 0; i < banco.length; i++) {

                if (bancoUsados.has(i)) continue;

                const b = banco[i];

                let mejorIndice = -1;
                let mejorDiferencia = Infinity;

                for (let j = 0; j < sistema.length; j++) {

                    if (sistemaUsados.has(j)) continue;

                    const s = sistema[j];

                    if (tipoBanco(b) !== tipoSistema(s)) continue;
                    if (!this.coincideImporte(b, s, tolerancia)) continue;

                    const montoBanco = Math.round(Number(b.monto) * 100);
                    const montoSinIva = Math.round(Number(s.monto) * 100);
                    const montoConIva = Math.round(Number(s.monto_con_iva) * 100);

                    const diferencia = Math.min(
                        Math.abs(montoBanco - montoSinIva),
                        Math.abs(montoBanco - montoConIva)
                    );

                    if (diferencia < mejorDiferencia) {
                        mejorDiferencia = diferencia;
                        mejorIndice = j;
                    }
                }

                if (mejorIndice === -1) continue;

                const k = llave(tipoBanco(b), b.fecha, money(b.monto));

                if (!sistemaMap.has(k)) sistemaMap.set(k, []);

                sistemaMap.get(k)!.push(sistema[mejorIndice]);

                bancoUsados.add(i);
                sistemaUsados.add(mejorIndice);
            }
        }

        // Movimientos del sistema que no encontraron pareja.
        for (let j = 0; j < sistema.length; j++) {

            if (sistemaUsados.has(j)) continue;

            const s = sistema[j];
            const t = tipoSistema(s);

            const sin = llave(t, s.fecha, money(s.monto));
            const con = llave(t, s.fecha, money(s.monto_con_iva));

            const k = bancoMap.has(sin)
                ? sin
                : bancoMap.has(con)
                    ? con
                    : sin;

            if (!sistemaMap.has(k)) sistemaMap.set(k, []);
            sistemaMap.get(k)!.push(s);
        }

        const llaves = Array.from(new Set([
            ...bancoMap.keys(),
            ...sistemaMap.keys()
        ]));

        const grupos = llaves
            .map(k => {

                const [tipo, fechaGrupo, montoStr] = k.split('|');
                const monto = Number(montoStr);

                const bs = (bancoMap.get(k) ?? [])
                    .sort((a, b) => a.fecha.localeCompare(b.fecha));

                const ss = (sistemaMap.get(k) ?? [])
                    .sort((a, b) => a.fecha.localeCompare(b.fecha));

                const nb = bs.length;
                const ns = ss.length;

                const sumaBanco = bs.reduce(
                    (total, b) => total + Number(b.monto), 0
                );

                // Utilizar el importe del sistema que realmente
                // coincide con el banco (sin IVA o con IVA).
                const sumaSistema = ss.reduce((total, s) => {

                    const sin = Number(s.monto);
                    const con = Number(s.monto_con_iva);

                    const importe = Math.abs(sin - monto) <=
                        Math.abs(con - monto) ? sin : con;

                    return total + importe;
                }, 0);

                const diferenciaImporte = Math.abs(
                    Math.round(sumaBanco * 100) -
                    Math.round(sumaSistema * 100)
                ) / 100;

                return {
                    fecha: fechaGrupo,
                    tipo,
                    monto,
                    n_banco: nb,
                    n_sistema: ns,
                    suma_banco: Number(sumaBanco.toFixed(2)),
                    suma_sistema: Number(sumaSistema.toFixed(2)),
                    estado: nb === ns
                        ? 'ok'
                        : nb > ns
                            ? 'falta_sistema'
                            : 'sobran_sistema',
                    diferencia: Math.abs(nb - ns),
                    diferencia_importe: Number(diferenciaImporte.toFixed(2)),
                    tolerancia: nb === ns && diferenciaImporte > 0,
                    banco: bs,
                    sistema: ss,
                };
            })
            .sort((a, b) => a.fecha.localeCompare(b.fecha));


        const suma = (arr: MovimientoBanco[]) => arr.reduce((t, b) => t + b.monto, 0);
        const ingresosBanco = suma(banco.filter(b => tipoBanco(b) === 'ingreso'));
        const egresosBanco = suma(banco.filter(b => tipoBanco(b) === 'egreso'));
        const ingresosSistema = grupos.filter(g => g.tipo === 'ingreso').reduce((t, g) => t + g.suma_sistema, 0);
        const egresosSistema = grupos.filter(g => g.tipo === 'egreso').reduce((t, g) => t + g.suma_sistema, 0);

        return {
            periodo: { desde, hasta },
            resumen: {
                movs_banco: banco.length,
                movs_sistema: sistema.length,
                ingresos_banco: Number(ingresosBanco.toFixed(2)),
                egresos_banco: Number(egresosBanco.toFixed(2)),
                ingresos_sistema: Number(ingresosSistema.toFixed(2)),
                egresos_sistema: Number(egresosSistema.toFixed(2)),
                grupos_ok: grupos.filter(g => g.estado === 'ok').length,
                grupos_revisar: grupos.filter(g => g.estado !== 'ok').length,
            },
            grupos,
        };
    }
}