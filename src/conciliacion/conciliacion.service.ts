import { Injectable, BadRequestException, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

const MESES: Record<string, number> = {
    ENE: 1, FEB: 2, MAR: 3, ABR: 4, MAY: 5, JUN: 6,
    JUL: 7, AGO: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12,
};

const CUENTA = 'BANORTE';

export interface MovimientoBanco {
    id?: number;
    fecha: string;
    descripcion: string;
    monto: number;
    saldo: number;
    tipo: 'cargo' | 'abono' | null;
    notas?: any[];
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
    notas?: any[];
}

@Injectable()
export class ConciliacionService {

    constructor(
        @InjectDataSource()
        private readonly dataSource: DataSource,
    ) { }

    // ============================================
    // TIPO: el saldo manda, la descripción es respaldo
    // ============================================
    private detectarTipoMovimiento(
        descripcion: string,
        tipoPorSaldo: 'cargo' | 'abono' | null
    ): 'cargo' | 'abono' | null {

        if (tipoPorSaldo) return tipoPorSaldo;

        const texto = descripcion
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toUpperCase().replace(/\s+/g, ' ').trim();

        if (/\bSPEI RECIBIDO\b/.test(texto) || /\bDE LA CUENTA\b/.test(texto)) return 'abono';
        if (/\bTRASPASO A CUENTA\b/.test(texto) || /\bSPEI ENVIADO\b/.test(texto)) return 'cargo';
        return null;
    }

    // ============================================
    // 1. LEER ESTADO DE CUENTA BANORTE
    // ============================================
    private parsear(texto: string): { filas: MovimientoBanco[]; saldoInicial: number | null } {



        const reFecha = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})/;
        const reFin = /^(TOTAL|TOTALES|P[ÁA]GINA|SALDO PROMEDIO|SALDO FINAL|RESUMEN|CADENA ORIGINAL|SELLO|Línea Directa|Banco Mercantil)/i;

        const num = (v: string): number => Number(v.replace(/,/g, ''));
        const pad = (v: number): string => String(v).padStart(2, '0');
        const reDinero = /\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2}/g;

        const filas: MovimientoBanco[] = [];

        let inicio = texto.indexOf('DETALLE DE MOVIMIENTOS');
        if (inicio === -1) inicio = 0;
        const lineas = texto.substring(inicio).split('\n');


        const saldoIni = texto.match(/\(Saldo inicial de\s*\$?\s*([\d,]+\.\d{2})\)/i);
        const saldoInicial = saldoIni ? num(saldoIni[1]) : null;
        let saldoPrev: number | null = saldoInicial;

        const candidatos = (s: string): { monto: number; saldo: number; corte: number }[] => {
            const res: { monto: number; saldo: number; corte: number }[] = [];
            const m = s.match(/(\d{1,3}(?:,\d{3})*\.\d{2})$/);
            if (!m) return res;
            const finales: string[] = [];
            for (let len = 4; len <= Math.min(14, s.length); len++) {
                const suf = s.slice(-len);
                if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(suf)) finales.push(suf);
            }
            for (const saldoStr of finales) {
                const resto = s.slice(0, s.length - saldoStr.length);
                for (let len = 4; len <= Math.min(14, resto.length); len++) {
                    const suf = resto.slice(-len);
                    if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(suf)) {
                        res.push({ monto: num(suf), saldo: num(saldoStr), corte: resto.length - len });
                    }
                }
            }
            return res;
        };

        let bloque: string[] = [];

        const procesar = (): void => {
            if (!bloque.length) return;

            const f = bloque[0].match(reFecha);
            if (!f) return;

            const mes = MESES[f[2].toUpperCase()];
            if (!mes) return;
            const dia = Number(f[1]);
            let anio = Number(f[3]);
            if (anio < 100) anio += 2000;
            const fecha = `${anio}-${pad(mes)}-${pad(dia)}`;

            const contenido = bloque.join(' ').replace(/\s+/g, ' ').trim();





            if (/SALDO ANTERIOR/i.test(contenido)) {
                const ds = contenido.match(reDinero);
                if (ds) saldoPrev = num(ds[ds.length - 1]);
                return;
            }

            // ===== DEVOLUCIÓN SPEI =====
            if (/DEV\.SPEI/i.test(contenido)) {
                const devolucion = contenido.match(
                    /([\d,]+\.\d{2})-([\d,]+\.\d{2})\s*$/
                );

                if (devolucion && saldoPrev !== null) {
                    const monto = num(devolucion[1]);
                    const saldo = num(devolucion[2]);

                    if (Math.abs(saldoPrev + monto - saldo) <= 0.02) {
                        const descripcion = contenido
                            .substring(f[0].length)
                            .replace(/[\d,]+\.\d{2}-[\d,]+\.\d{2}\s*$/, '')
                            .trim();

                        filas.push({
                            fecha,
                            descripcion,
                            monto,
                            saldo,
                            tipo: 'abono',
                        });


                        saldoPrev = saldo;
                        return;
                    }
                }

                console.warn('⚠️ NO SE PUDO PROCESAR DEVOLUCIÓN SPEI:', {
                    contenido,
                    saldoPrev,
                    devolucion,
                });

                return;
            }





            const contenidoLimpio = contenido.replace(
                /\s+INVERSION ENLACE NEGOCIOS\s*$/i,
                ''
            );

            const colaMatch = contenidoLimpio.match(
                /[\d,]+\.\d{2}(?:-?[\d,]+\.\d{2})*$/
            );

            if (!colaMatch) {
                console.warn('❌ FALLÓ colaMatch:', contenidoLimpio);
                return;
            }

            const cola = colaMatch[0].trim();





            let elegido: { monto: number; saldo: number; corte: number } | null = null;
            let tipo: 'cargo' | 'abono' | null = null;

            if (saldoPrev !== null) {
                for (const c of candidatos(cola)) {
                    if (c.monto <= 0) continue;
                    if (Math.abs(saldoPrev - c.monto - c.saldo) <= 0.02) { elegido = c; tipo = 'cargo'; break; }
                    if (Math.abs(saldoPrev + c.monto - c.saldo) <= 0.02) { elegido = c; tipo = 'abono'; break; }
                }
            }



            if (!elegido) {
                console.warn('⚠️ NO CUADRÓ:', {
                    fecha,
                    saldoPrev,
                    cola,
                    candidatos: candidatos(cola),
                    contenido: contenido.substring(0, 200),
                });
                return;
            }

            saldoPrev = elegido.saldo;

            const posCola = contenidoLimpio.length - cola.length;
            const descripcion = contenidoLimpio
                .substring(f[0].length, posCola + elegido.corte)
                .replace(/\s+/g, ' ')
                .trim();

            const tipoDetectado = this.detectarTipoMovimiento(descripcion, tipo);

            // Comisión SPEI ($5.00) e IVA ($0.80): se omiten
            filas.push({
                fecha,
                descripcion,
                monto: elegido.monto,
                saldo: elegido.saldo,
                tipo: tipoDetectado,
            });
        };


        for (const original of lineas) {
            const linea = original.trim();
            if (!linea) continue;

            if (reFecha.test(linea)) {
                procesar();
                bloque = [linea];

            } else if (
                reFin.test(linea) ||
                /^FECHA\s*DESCRIPCI[ÓO]N/i.test(linea)
            ) {
                procesar();
                bloque = [];

            } else if (bloque.length) {
                bloque.push(linea);
            }
        }


        procesar();



        return { filas, saldoInicial };
    }

    // ============================================
    // 2. COMPARAR IMPORTE / TIPO
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
    // 3. ARMAR LA CONCILIACIÓN (banco ya leído + sistema en vivo)
    // ============================================
    private async armar(bancoOrig: MovimientoBanco[], conciliacionId?: number) {

        const fechas = bancoOrig.map(b => b.fecha).sort();
        const desde = fechas[0];
        const hasta = fechas[fechas.length - 1];
        const mesConsulta = `${desde.substring(0, 7)}-01`;

        const sistemaOrig: MovimientoSistema[] = await this.dataSource.query(
            `
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
            WHERE (
    tipo_movimiento_id IN (1, 2, 4)
    OR (tipo_movimiento_id = 3 AND categoria_id = 16)
)
              AND metodo_pago_id IN (2, 6)
              AND fecha_pago >= ?
              AND fecha_pago < DATE_ADD(?, INTERVAL 1 MONTH)
            ORDER BY fecha_pago, id
            `,
            [mesConsulta, mesConsulta],
        );



        const tipoBanco = (b: MovimientoBanco): 'ingreso' | 'egreso' =>
            b.tipo === 'abono' ? 'ingreso' : 'egreso';

        const tipoSistema = (s: MovimientoSistema): 'ingreso' | 'egreso' =>
            [1, 4].includes(Number(s.tipo_movimiento_id)) ? 'ingreso' : 'egreso';

        // ===== Uniones manuales y notas guardadas =====
        let gruposDb: any[] = [];
        let miembrosDb: any[] = [];
        let notasDb: any[] = [];

        if (conciliacionId) {
            gruposDb = await this.dataSource.query(
                `SELECT id, comentario, creado_por, created_at
                 FROM conciliacion_grupos
                 WHERE conciliacion_id = ? AND origen = 'manual'
                 ORDER BY id`,
                [conciliacionId],
            );
            if (gruposDb.length) {
                const ph = gruposDb.map(() => '?').join(',');
                miembrosDb = await this.dataSource.query(
                    `SELECT grupo_id, lado, banco_id, sistema_id
                     FROM conciliacion_miembros WHERE grupo_id IN (${ph})`,
                    gruposDb.map(g => g.id),
                );
            }
            notasDb = await this.dataSource.query(
                `SELECT id, lado, banco_id, sistema_id, comentario, creado_por, created_at
                 FROM conciliacion_notas WHERE conciliacion_id = ? ORDER BY id`,
                [conciliacionId],
            );
        }

        // Adjuntar notas a cada renglón
        const bancoTodo: MovimientoBanco[] = bancoOrig.map(b => ({
            ...b,
            notas: notasDb.filter(n => n.lado === 'banco' && Number(n.banco_id) === b.id),
        }));
        const sistemaTodo: MovimientoSistema[] = sistemaOrig.map(s => ({
            ...s,
            notas: notasDb.filter(n => n.lado === 'sistema' && Number(n.sistema_id) === Number(s.id)),
        }));

        // ===== Grupos manuales =====
        const usadosB = new Set<number>();
        const usadosS = new Set<number>();

        const manuales = gruposDb.map(g => {
            const mem = miembrosDb.filter(m => m.grupo_id === g.id);
            const bs = bancoTodo.filter(b =>
                mem.some(m => m.lado === 'banco' && Number(m.banco_id) === b.id));
            const ss = sistemaTodo.filter(s =>
                mem.some(m => m.lado === 'sistema' && Number(m.sistema_id) === Number(s.id)));

            bs.forEach(b => usadosB.add(b.id!));
            ss.forEach(s => usadosS.add(Number(s.id)));

            const sumaBanco = bs.reduce((t, b) => t + Number(b.monto), 0);
            const sumaSin = ss.reduce((t, s) => t + Number(s.monto), 0);
            const sumaCon = ss.reduce((t, s) => t + Number(s.monto_con_iva), 0);
            const sumaSistema =
                Math.abs(sumaSin - sumaBanco) <= Math.abs(sumaCon - sumaBanco) ? sumaSin : sumaCon;
            const dif = Math.abs(Math.round(sumaBanco * 100) - Math.round(sumaSistema * 100)) / 100;

            return {
                manual: true,
                grupo_id: g.id,
                comentario: g.comentario,
                creado_por: g.creado_por,
                fecha: bs.length ? bs.map(b => b.fecha).sort()[0] : desde,
                tipo: bs.length ? tipoBanco(bs[0]) : 'egreso',
                monto: bs.length
    ? Number((sumaBanco / bs.length).toFixed(2))
    : Number(sumaSistema.toFixed(2)),
                n_banco: bs.length,
                n_sistema: ss.length,
                suma_banco: Number(sumaBanco.toFixed(2)),
                suma_sistema: Number(sumaSistema.toFixed(2)),
                estado: dif <= 0.05 && bs.length && ss.length ? 'ok' : 'revisar',
                diferencia: 0,
                diferencia_importe: Number(dif.toFixed(2)),
                tolerancia: false,
                banco: bs,
                sistema: ss,
            };
        });

        // Lo ya unido a mano no entra al emparejamiento automático
        const banco = bancoTodo.filter(b => !usadosB.has(b.id!));
        const sistema = sistemaTodo.filter(s => !usadosS.has(Number(s.id)));


        // ===== Emparejamiento automático seguro =====
        // Solo conciliamos automáticamente cuando la coincidencia es única.
        // Si varios movimientos pueden corresponder al mismo registro,
        // todos quedan pendientes para que el usuario decida manualmente.

        const automaticos: any[] = [];

        const bancosPendientes = new Set<number>(
            banco.map((_, i) => i)
        );

        const sistemasPendientes = new Set<number>(
            sistema.map((_, i) => i)
        );

        const parejas: {
            bancoIndex: number;
            sistemaIndex: number;
        }[] = [];

        for (const tolerancia of [0, 5]) {
            const candidatosBanco = new Map<number, number[]>();
            const candidatosSistema = new Map<number, number[]>();

            // Buscar candidatos para cada movimiento bancario.
            for (const i of bancosPendientes) {
                const b = banco[i];
                const posibles: number[] = [];

                for (const j of sistemasPendientes) {
                    const s = sistema[j];

                    if (tipoBanco(b) !== tipoSistema(s)) continue;

                    if (!this.coincideImporte(b, s, tolerancia)) {
                        continue;
                    }

                    posibles.push(j);

                    if (!candidatosSistema.has(j)) {
                        candidatosSistema.set(j, []);
                    }

                    candidatosSistema.get(j)!.push(i);
                }

                candidatosBanco.set(i, posibles);
            }

            // Solo aceptar coincidencias únicas en ambos sentidos.
            const nuevasParejas: {
                bancoIndex: number;
                sistemaIndex: number;
            }[] = [];

            for (const [i, posibles] of candidatosBanco) {
                if (posibles.length !== 1) continue;

                const j = posibles[0];
                const posiblesBancos = candidatosSistema.get(j) ?? [];

                if (posiblesBancos.length !== 1) continue;

                nuevasParejas.push({
                    bancoIndex: i,
                    sistemaIndex: j,
                });
            }

            // Reservar las parejas encontradas.
            for (const pareja of nuevasParejas) {
                if (
                    !bancosPendientes.has(pareja.bancoIndex) ||
                    !sistemasPendientes.has(pareja.sistemaIndex)
                ) {
                    continue;
                }

                parejas.push(pareja);
                bancosPendientes.delete(pareja.bancoIndex);
                sistemasPendientes.delete(pareja.sistemaIndex);
            }
        }

        // Crear grupos conciliados automáticamente.
        for (const pareja of parejas) {
            const b = banco[pareja.bancoIndex];
            const s = sistema[pareja.sistemaIndex];

            const montoBanco = Math.round(Number(b.monto) * 100);
            const montoSinIva = Math.round(Number(s.monto) * 100);
            const montoConIva = Math.round(Number(s.monto_con_iva) * 100);

            const diferenciaCentavos = Math.min(
                Math.abs(montoBanco - montoSinIva),
                Math.abs(montoBanco - montoConIva)
            );

            const montoSistema =
                Math.abs(montoBanco - montoSinIva) <=
                    Math.abs(montoBanco - montoConIva)
                    ? Number(s.monto)
                    : Number(s.monto_con_iva);

            automaticos.push({
                manual: false,
                fecha: b.fecha,
                tipo: tipoBanco(b),
                monto: Number(b.monto),
                n_banco: 1,
                n_sistema: 1,
                suma_banco: Number(Number(b.monto).toFixed(2)),
                suma_sistema: Number(montoSistema.toFixed(2)),
                estado: 'ok',
                diferencia: 0,
                diferencia_importe: Number(
                    (diferenciaCentavos / 100).toFixed(2)
                ),
                tolerancia: diferenciaCentavos > 0,
                banco: [b],
                sistema: [s],
            });
        }

        // Cada movimiento bancario ambiguo o sin coincidencia
        // queda en su propio grupo pendiente.
        for (const i of bancosPendientes) {
            const b = banco[i];

            automaticos.push({
                manual: false,
                fecha: b.fecha,
                tipo: tipoBanco(b),
                monto: Number(b.monto),
                n_banco: 1,
                n_sistema: 0,
                suma_banco: Number(Number(b.monto).toFixed(2)),
                suma_sistema: 0,
                estado: 'falta_sistema',
                diferencia: 1,
                diferencia_importe: Number(Number(b.monto).toFixed(2)),
                tolerancia: false,
                banco: [b],
                sistema: [],
            });
        }

        // Cada movimiento del sistema sin pareja confirmada
        // queda separado, incluso si existe un importe igual en el banco.
        for (const j of sistemasPendientes) {
            const s = sistema[j];
            const monto = Number(s.monto);

            automaticos.push({
                manual: false,
                fecha: s.fecha,
                tipo: tipoSistema(s),
                monto,
                n_banco: 0,
                n_sistema: 1,
                suma_banco: 0,
                suma_sistema: Number(monto.toFixed(2)),
                estado: 'sobran_sistema',
                diferencia: 1,
                diferencia_importe: Number(monto.toFixed(2)),
                tolerancia: false,
                banco: [],
                sistema: [s],
            });
        }

        const grupos: any[] = [...automaticos, ...manuales]
            .sort((a, b) => a.fecha.localeCompare(b.fecha));

        const suma = (arr: MovimientoBanco[]) => arr.reduce((t, b) => t + b.monto, 0);
        const ingresosBanco = suma(bancoTodo.filter(b => tipoBanco(b) === 'ingreso'));
        const egresosBanco = suma(bancoTodo.filter(b => tipoBanco(b) === 'egreso'));
        const ingresosSistema = grupos.filter(g => g.tipo === 'ingreso').reduce((t, g) => t + g.suma_sistema, 0);
        const egresosSistema = grupos.filter(g => g.tipo === 'egreso').reduce((t, g) => t + g.suma_sistema, 0);

        return {
            periodo: { desde, hasta },
            resumen: {
                movs_banco: bancoTodo.length,
                movs_sistema: sistemaTodo.length,
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

    // ============================================
    // 4. CARGAR LA CONCILIACIÓN GUARDADA DE UN MES
    // ============================================
    async cargar(anioParam: number, mesParam: number) {
        const anio = Number(anioParam);
        const mes = Number(mesParam);

        const cab: any[] = await this.dataSource.query(
            `SELECT id, anio, mes, cuenta, archivo_nombre, saldo_inicial, saldo_final,
                    creado_por, created_at, updated_at
             FROM conciliaciones
             WHERE anio = ? AND mes = ? AND cuenta = ?`,
            [anio, mes, CUENTA],
        );
        if (!cab.length) return null;

        const filas: any[] = await this.dataSource.query(
            `SELECT id, DATE_FORMAT(fecha, '%Y-%m-%d') AS fecha, descripcion, monto, tipo, saldo
             FROM conciliacion_banco
             WHERE conciliacion_id = ?
             ORDER BY orden`,
            [cab[0].id],
        );

        const banco: MovimientoBanco[] = filas.map(f => ({
            id: f.id,
            fecha: f.fecha,
            descripcion: f.descripcion,
            monto: Number(f.monto),
            saldo: Number(f.saldo),
            tipo: f.tipo === 'ingreso' ? 'abono' : 'cargo',
        }));

        const resultado = await this.armar(banco, cab[0].id);
        return { conciliacion: cab[0], ...resultado };
    }

    // ============================================
    // 5. SUBIR PDF Y GUARDAR
    // ============================================
    async conciliar(buffer: Buffer, nombreArchivo: string, reemplazar: boolean, usuario: string | null) {

        const pdf = await pdfParse(buffer);
        const resultado = this.parsear(pdf.text);
        const filas = this.agruparComisiones(resultado.filas);
        const saldoInicial = resultado.saldoInicial;




        if (!filas.length) {
            throw new BadRequestException(
                'No pude leer movimientos en el PDF. Verifica que sea un estado de cuenta Banorte válido.'
            );
        }

        const fechas = filas.map(b => b.fecha).sort();
        const [anioStr, mesStr] = fechas[0].split('-');
        const anio = Number(anioStr);
        const mes = Number(mesStr);

        const existe: any[] = await this.dataSource.query(
            `SELECT id FROM conciliaciones WHERE anio = ? AND mes = ? AND cuenta = ?`,
            [anio, mes, CUENTA],
        );

        if (existe.length && !reemplazar) {
            throw new ConflictException({
                code: 'YA_EXISTE',
                message: 'Ya existe una conciliación de este mes.',
                anio, mes,
            });
        }

        const saldoFinal = filas[filas.length - 1].saldo;

        await this.dataSource.transaction(async (m) => {

            if (existe.length) {
                // ON DELETE CASCADE borra renglones, grupos, miembros y notas
                await m.query(`DELETE FROM conciliaciones WHERE id = ?`, [existe[0].id]);
            }

            const ins: any = await m.query(
                `INSERT INTO conciliaciones
                    (anio, mes, cuenta, archivo_nombre, saldo_inicial, saldo_final, creado_por,created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?,DATE_SUB(NOW(), INTERVAL 7 HOUR), DATE_SUB(NOW(), INTERVAL 7 HOUR))`,
                [anio, mes, CUENTA, nombreArchivo, saldoInicial, saldoFinal, usuario],
            );
            const conciliacionId = ins.insertId;

            let orden = 0;
            for (const b of filas) {
                orden++;
                await m.query(
                    `INSERT INTO conciliacion_banco
                        (conciliacion_id, fecha, descripcion, monto, tipo, saldo, orden)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [conciliacionId, b.fecha, b.descripcion, b.monto,
                        b.tipo === 'abono' ? 'ingreso' : 'egreso', b.saldo, orden],
                );
            }
        });



        return this.cargar(anio, mes);
    }

    // ============================================
    // 6. UNIONES MANUALES Y COMENTARIOS
    // ============================================
    private async recargar(conciliacionId: number) {
        const c: any[] = await this.dataSource.query(
            `SELECT anio, mes FROM conciliaciones WHERE id = ?`, [conciliacionId]);
        if (!c.length) throw new NotFoundException('Conciliación no encontrada');
        return this.cargar(c[0].anio, c[0].mes);
    }

    async unir(
        conciliacionId: number,
        bancoIds: number[],
        sistemaIds: number[],
        comentario: string | null,
        usuario: string | null,
    ) {
        conciliacionId = Number(conciliacionId);
        bancoIds = (bancoIds || []).map(Number);
        sistemaIds = (sistemaIds || []).map(Number);

        if (!bancoIds.length || !sistemaIds.length) {
            throw new BadRequestException('Selecciona al menos un renglón del PDF y uno del sistema.');
        }

        const phB = bancoIds.map(() => '?').join(',');
        const phS = sistemaIds.map(() => '?').join(',');

        const bancos: any[] = await this.dataSource.query(
            `SELECT id, monto, tipo FROM conciliacion_banco
             WHERE conciliacion_id = ? AND id IN (${phB})`,
            [conciliacionId, ...bancoIds],
        );
        if (bancos.length !== bancoIds.length) {
            throw new BadRequestException('Algún renglón del PDF no pertenece a esta conciliación.');
        }
        if (new Set(bancos.map(b => b.tipo)).size > 1) {
            throw new BadRequestException('No puedes mezclar ingresos y egresos en una unión.');
        }

        const sistemas: any[] = await this.dataSource.query(
            `SELECT id, importe_sin_iva, COALESCE(iva_acreditable, 0) AS iva
             FROM movimientos_financieros WHERE id IN (${phS})`,
            sistemaIds,
        );
        if (sistemas.length !== sistemaIds.length) {
            throw new BadRequestException('Algún movimiento del sistema ya no existe.');
        }

        // No permitir que un renglón esté en dos uniones
        const ocupados: any[] = await this.dataSource.query(
            `SELECT m.id
             FROM conciliacion_miembros m
             JOIN conciliacion_grupos g ON g.id = m.grupo_id
             WHERE g.conciliacion_id = ?
               AND ((m.lado = 'banco' AND m.banco_id IN (${phB}))
                 OR (m.lado = 'sistema' AND m.sistema_id IN (${phS})))`,
            [conciliacionId, ...bancoIds, ...sistemaIds],
        );
        if (ocupados.length) {
            throw new BadRequestException('Alguno de los renglones ya está en otra unión.');
        }

        // Las sumas deben cuadrar (sin IVA o con IVA)
        const cent = (n: any) => Math.round(Number(n) * 100);
        const sumB = bancos.reduce((t, b) => t + cent(b.monto), 0);
        const sumSin = sistemas.reduce((t, s) => t + cent(s.importe_sin_iva), 0);
        const sumCon = sistemas.reduce((t, s) => t + cent(s.importe_sin_iva) + cent(s.iva), 0);

        if (Math.abs(sumB - sumSin) > 5 && Math.abs(sumB - sumCon) > 5) {
            throw new BadRequestException(
                `Las sumas no cuadran: PDF ${(sumB / 100).toFixed(2)} · ` +
                `Sistema sin IVA ${(sumSin / 100).toFixed(2)} · con IVA ${(sumCon / 100).toFixed(2)}`);
        }

        await this.dataSource.transaction(async (m) => {
            const ins: any = await m.query(
                `INSERT INTO conciliacion_grupos (conciliacion_id, origen, comentario, creado_por)
                 VALUES (?, 'manual', ?, ?)`,
                [conciliacionId, comentario || null, usuario],
            );
            const grupoId = ins.insertId;

            for (const id of bancoIds) {
                await m.query(
                    `INSERT INTO conciliacion_miembros (grupo_id, lado, banco_id) VALUES (?, 'banco', ?)`,
                    [grupoId, id]);
            }
            for (const id of sistemaIds) {
                await m.query(
                    `INSERT INTO conciliacion_miembros (grupo_id, lado, sistema_id) VALUES (?, 'sistema', ?)`,
                    [grupoId, id]);
            }
        });

        return this.recargar(conciliacionId);
    }


    private agruparComisiones(filas: MovimientoBanco[]): MovimientoBanco[] {
        const patrones = [
            /TRANSFERENCIA\s*-\s*ENVIO.*SPEI.*BANCA POR INTERNET/i,
            /I\.?V\.?A\.?\s+ORDEN DE PAGO SPEI REFERENCIA/i,
            /ADMINISTRACION\s*-\s*RENTA COMISION MEMBRESIA P\.?\s*MORAL/i,
            /IVA COM MEMB P\.?M\.?\s*COMISION MEMBRESIA P\.?\s*MORAL/i,
            /EMISION DE CHEQUERA/i,
            /EXCEDIDAS A MEMBRESIA/i,
        ];

        const comisiones = filas.filter(f =>
            patrones.some(p => p.test(f.descripcion))
        );

        if (!comisiones.length) {
            return filas;
        }

        // Todos los cargos de comisiones encontrados en el PDF.
        const montoTotal = Number(
            comisiones.reduce((total, f) => total + f.monto, 0).toFixed(2)
        );

        // Retiramos los movimientos individuales.
        const restantes = filas.filter(f => !comisiones.includes(f));

        // Usamos el último movimiento encontrado como referencia de fecha.
        const ultimo = comisiones[comisiones.length - 1];

        const agrupado: MovimientoBanco = {
            fecha: ultimo.fecha,
            descripcion: 'COMISIONES BANCARIAS E IVA DEL MES',
            monto: montoTotal,
            saldo: ultimo.saldo,
            tipo: 'cargo',
        };

        // Insertamos el movimiento agrupado respetando el orden cronológico.
        restantes.push(agrupado);
        restantes.sort((a, b) => a.fecha.localeCompare(b.fecha));



        return restantes;
    }


    async quitarUnion(grupoId: number, usuario: string | null) {

        if (!usuario) {
            throw new ForbiddenException('Usuario no autenticado.');
        }

        const g: any[] = await this.dataSource.query(
            `SELECT conciliacion_id, creado_por
         FROM conciliacion_grupos
         WHERE id = ? AND origen = 'manual'`,
            [Number(grupoId)]
        );

        if (!g.length) {
            throw new NotFoundException('Unión no encontrada');
        }

        if (g[0].creado_por !== usuario) {
            throw new ForbiddenException(
                'Solo el usuario que realizó esta unión puede deshacerla.'
            );
        }

        const eliminado: any = await this.dataSource.query(
            `DELETE FROM conciliacion_grupos
         WHERE id = ? AND creado_por = ? AND origen = 'manual'`,
            [Number(grupoId), usuario]
        );

        if (eliminado.affectedRows !== 1) {
            throw new ForbiddenException('No tienes permiso para deshacer esta unión.');
        }

        return this.recargar(g[0].conciliacion_id);
    }

    async agregarNota(
        conciliacionId: number,
        lado: 'banco' | 'sistema',
        refId: number,
        comentario: string,
        usuario: string | null,
    ) {
        if (!comentario?.trim()) throw new BadRequestException('El comentario está vacío.');
        if (lado !== 'banco' && lado !== 'sistema') throw new BadRequestException('Lado inválido.');

        await this.dataSource.query(
            `INSERT INTO conciliacion_notas
                (conciliacion_id, lado, banco_id, sistema_id, comentario, creado_por)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [Number(conciliacionId), lado,
            lado === 'banco' ? Number(refId) : null,
            lado === 'sistema' ? Number(refId) : null,
            comentario.trim(), usuario],
        );
        return this.recargar(Number(conciliacionId));
    }

    async quitarNota(notaId: number) {
        const n: any[] = await this.dataSource.query(
            `SELECT conciliacion_id FROM conciliacion_notas WHERE id = ?`, [Number(notaId)]);
        if (!n.length) throw new NotFoundException('Nota no encontrada');

        await this.dataSource.query(`DELETE FROM conciliacion_notas WHERE id = ?`, [Number(notaId)]);
        return this.recargar(n[0].conciliacion_id);
    }
}