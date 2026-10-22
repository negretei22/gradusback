import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CajaChicaService } from '../caja-chica/caja_chica.service';

// ⚠️ Confirma estos ids con tu catálogo de métodos de pago
const FORMA_PAGO: Record<number, string> = {
    2: 'Transferencia electrónica de fondos',
    3: 'Tarjeta de débito',
};

@Injectable()
export class BancosCajaChicaService {

    // Si el saldo del banco no sale solo de la base, pon aquí el saldo inicial
    private readonly BANCO_SALDO_INICIAL = 0;

    constructor(
        @InjectDataSource() private dataSource: DataSource,
        private cajaChica: CajaChicaService,
    ) { }


    private palabras(txt: string): Set<string> {
        const vacias = new Set(['DE', 'DEL', 'LA', 'EL', 'LOS', 'LAS', 'Y', 'A', 'EN', 'POR', 'MENSUAL', 'PAGO', 'EFECTIVO', 'CAJA', 'CHICA']);
        return new Set(
            (txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ')
                .split(/\s+/).filter(w => w && !vacias.has(w))
        );
    }

    // Devuelve { score, comunes }
    private similitud(a: string, b: string) {
        const A = this.palabras(a), B = this.palabras(b);
        if (!A.size || !B.size) return { score: 0, comunes: 0 };
        let comunes = 0;
        A.forEach(w => { if (B.has(w)) comunes++; });
        return { score: comunes / Math.min(A.size, B.size), comunes };
    }

    private diasEntre(f1: string, f2: string): number {
        return Math.abs((Date.parse(f1) - Date.parse(f2)) / 86400000);
    }

    // Une en un solo renglón el movimiento de caja con su pareja del banco
    private fusionar(filasBanco: any[], filasCaja: any[]): any[] {
        const bancos = filasBanco.map(b => ({ ...b }));
        const usados = new Set<number>();
        const sueltasCaja: any[] = [];

        for (const c of filasCaja) {
            const esGasto = c.caja_gasto > 0;
            let mejor: any = null, mejorScore = -1;

            for (const b of bancos) {
                if (usados.has(b.ref)) continue;
                const mismoTipo = esGasto ? b.banco_gasto > 0 : b.banco_ingreso > 0;
                if (!mismoTipo) continue;

                const dias = this.diasEntre(b.fecha, c.fecha);
                if (dias > 3) continue;

                const { score, comunes } = this.similitud(b.concepto, c.concepto);
                if (comunes < 1 || score < 0.5) continue;

                const total = score - dias * 0.1;
                if (total > mejorScore) { mejorScore = total; mejor = b; }
            }

            if (mejor) {
                usados.add(mejor.ref);
                mejor.origen = 'ambos';
                mejor.caja_gasto = c.caja_gasto;
                mejor.caja_ingreso = c.caja_ingreso;
                mejor.concepto_caja = c.concepto;
                mejor.forma_pago = `${mejor.forma_pago} + Efectivo`;
            } else {
                sueltasCaja.push(c);
            }
        }
        return [...bancos, ...sueltasCaja];
    }
    async guardarSaldo(anio: number, mes: number, b: any) {
        await this.dataSource.query(
            `INSERT INTO saldos_bancos_caja (anio, mes, banco_gasto, banco_ingreso, caja_gasto, caja_ingreso)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               banco_gasto = VALUES(banco_gasto), banco_ingreso = VALUES(banco_ingreso),
               caja_gasto = VALUES(caja_gasto), caja_ingreso = VALUES(caja_ingreso)`,
            [Number(anio), Number(mes),
            Number(b.banco_gasto) || 0, Number(b.banco_ingreso) || 0,
            Number(b.caja_gasto) || 0, Number(b.caja_ingreso) || 0],
        );
        return { ok: true };
    }

    // Guarda el saldo final de este mes como saldo anterior del mes siguiente
    async cerrarMes(anio: number, mes: number) {
        const actual = await this.getMes(anio, mes);
        const sigMes = Number(mes) === 12 ? 1 : Number(mes) + 1;
        const sigAnio = Number(mes) === 12 ? Number(anio) + 1 : Number(anio);
        const { banco, caja } = actual.saldo_final;

        return this.guardarSaldo(sigAnio, sigMes, {
            banco_gasto: banco < 0 ? -banco : 0, banco_ingreso: banco > 0 ? banco : 0,
            caja_gasto: caja < 0 ? -caja : 0, caja_ingreso: caja > 0 ? caja : 0,
        });
    }

    async getMes(anioParam: number, mesParam: number) {
        const anio = Number(anioParam);
        const mes = Number(mesParam);
        const pad = (n: number) => String(n).padStart(2, '0');

        const desde = `${anio}-${pad(mes)}-01`;
        const hasta = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${pad(mes + 1)}-01`;

        // ===== BANCO =====
        const bancoMes: any[] = await this.dataSource.query(
            `SELECT id,
                    DATE_FORMAT(fecha_pago, '%Y-%m-%d') AS fecha,
                    concepto, tipo_movimiento_id, metodo_pago_id, importe_sin_iva
             FROM movimientos_financieros
             WHERE tipo_movimiento_id IN ('1','2')
               AND metodo_pago_id IN (2,3,4)
               AND fecha_pago >= ? AND fecha_pago < ?
             ORDER BY fecha_pago, id`,
            [desde, hasta],
        );

        const bancoPrev: any[] = await this.dataSource.query(
            `SELECT SUM(CASE WHEN tipo_movimiento_id = '1' THEN importe_sin_iva ELSE -importe_sin_iva END) AS saldo
             FROM movimientos_financieros
             WHERE tipo_movimiento_id IN ('1','2')
               AND metodo_pago_id IN (2,3)
               AND fecha_pago < ?`,
            [desde],
        );

        // ===== CAJA CHICA (Sheet) =====
        const todos = await this.cajaChica.leerTodo(process.env.SHEET_GID_BANCOS!);
        const cajaMes = todos.filter(m => m.fecha >= desde && m.fecha < hasta);

        // ===== FILAS BASE =====
        const filasBanco = bancoMes.map(b => {
            const monto = Number(b.importe_sin_iva) || 0;
            const esEgreso = String(b.tipo_movimiento_id) === '2';
            return {
                origen: 'banco', ref: b.id, fecha: b.fecha, concepto: b.concepto,
                concepto_caja: null as string | null,
                banco_gasto: esEgreso ? monto : 0,
                banco_ingreso: esEgreso ? 0 : monto,
                caja_gasto: 0, caja_ingreso: 0,
                forma_pago: FORMA_PAGO[Number(b.metodo_pago_id)] ?? '',
            };
        });

        const filasCaja = cajaMes.map(c => ({
            origen: 'caja', ref: c.id, fecha: c.fecha, concepto: c.concepto,
            concepto_caja: null as string | null,
            banco_gasto: 0, banco_ingreso: 0,
            caja_gasto: c.gasto, caja_ingreso: c.ingreso,
            forma_pago: 'Efectivo',
        }));

        // ===== SALDO ANTERIOR (guardado o calculado) =====
        const guardado: any[] = await this.dataSource.query(
            `SELECT banco_gasto, banco_ingreso, caja_gasto, caja_ingreso
             FROM saldos_bancos_caja WHERE anio = ? AND mes = ?`,
            [anio, mes],
        );

        let saldoAnterior: any;
        const manual = guardado.length > 0;

        if (manual) {
            const g = guardado[0];
            saldoAnterior = {
                banco_gasto: Number(g.banco_gasto), banco_ingreso: Number(g.banco_ingreso),
                caja_gasto: Number(g.caja_gasto), caja_ingreso: Number(g.caja_ingreso),
            };
        } else {
            const netoBanco = this.BANCO_SALDO_INICIAL + (Number(bancoPrev[0]?.saldo) || 0);
            const netoCaja = todos.filter(m => m.fecha < desde).reduce((s, m) => s + m.ingreso - m.gasto, 0);
            saldoAnterior = {
                banco_gasto: netoBanco < 0 ? -netoBanco : 0,
                banco_ingreso: netoBanco > 0 ? netoBanco : 0,
                caja_gasto: netoCaja < 0 ? -netoCaja : 0,
                caja_ingreso: netoCaja > 0 ? netoCaja : 0,
            };
        }

        const netoBancoAnt = saldoAnterior.banco_ingreso - saldoAnterior.banco_gasto;
        const netoCajaAnt = saldoAnterior.caja_ingreso - saldoAnterior.caja_gasto;

        // ===== FUSIÓN + ORDEN + SALDO CORRIDO =====
        const orden: Record<string, number> = { banco: 0, ambos: 0, caja: 1 };
        let saldoBanco = netoBancoAnt;
        let saldoCaja = netoCajaAnt;

        const movimientos = this.fusionar(filasBanco, filasCaja)
            .sort((a, b) =>
                a.fecha.localeCompare(b.fecha) ||
                orden[a.origen] - orden[b.origen] ||
                a.ref - b.ref)
            .map((m, i) => {
                saldoBanco += m.banco_ingreso - m.banco_gasto;
                saldoCaja += m.caja_ingreso - m.caja_gasto;
                return { no: i + 1, ...m, saldo_banco: saldoBanco, saldo_caja: saldoCaja };
            });

        // ===== TOTALES =====
        const suma = (k: string) => movimientos.reduce((s, m) => s + (m[k] || 0), 0);

        const totales = {
            banco_gasto: suma('banco_gasto'),
            banco_ingreso: suma('banco_ingreso'),
            caja_gasto: suma('caja_gasto'),
            caja_ingreso: suma('caja_ingreso'),
        };

        return {
            saldo_anterior: saldoAnterior,
            saldo_anterior_guardado: manual,
            movimientos,
            totales,
            saldo_final: {
                banco: netoBancoAnt + totales.banco_ingreso - totales.banco_gasto,
                caja: netoCajaAnt + totales.caja_ingreso - totales.caja_gasto,
            },
        };
    }
}