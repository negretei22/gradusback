import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm/repository/Repository';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoCajaChica } from 'src/caja-chica/movimientos_caja_chica.entity';
import { renameSync } from 'fs';
import { join, extname, basename } from 'path';
import { Express } from 'express';

const LABELS_MAP: { [key: string]: string } = {
    archivo_prefactura: 'Prefactura',
    archivo_factura: 'Factura',
    archivo_nota_pago: 'Nota de Pago',
    archivo_pago: 'Pago',
    archivo_otra: 'Otra',
};

@Injectable()
export class FinanzasService {

    constructor(
        @InjectRepository(MovimientoFinanciero)
        private movimientoFinancieroRepo: Repository<MovimientoFinanciero>,
        @InjectRepository(CategoriaFinanciera)
        private categoriasFinancierasRepo: Repository<CategoriaFinanciera>,
        @InjectRepository(MetodoPago)
        private metodosPagoRepository: Repository<MetodoPago>,
        @InjectRepository(MovimientoCajaChica)
        private readonly movimientoCajaChicaRepo: Repository<MovimientoCajaChica>,
    ) { }

    async findMovimientos(anio?: string, mes?: string) {
        let where = '';
        if (anio && mes) {
            const fechaEfectiva = `
                CASE 
                    WHEN m.fecha_factura = '1899-11-30' or  m.fecha_factura = '0000-00-00' THEN m.fecha_pago 
                    ELSE m.fecha_factura 
                END
            `;

            if (mes == '0')
                where = `WHERE YEAR(${fechaEfectiva}) = ${anio}`;
            else
                where = `WHERE YEAR(${fechaEfectiva}) = ${anio} AND MONTH(${fechaEfectiva}) = ${mes}`;
        }

        const sql = `
            SELECT m.*, mp.nombre AS metodo_pago
            FROM movimientos_financieros m
            LEFT JOIN metodos_pago mp ON mp.id = m.metodo_pago_id
            ${where}
            ORDER BY m.orden, m.fecha_pago, m.fecha_pago ASC
        `;

        console.log('SQL findMovimientos:', sql);

        const result = await this.movimientoFinancieroRepo.query(sql);
        return result;
    }

    async actualizarOrdenMasivo(items: { id: number; orden: number }[]) {
        return this.movimientoFinancieroRepo.manager.transaction(async (manager) => {
            for (const item of items) {
                await manager.query(
                    `UPDATE movimientos_financieros SET orden = ? WHERE id = ?`,
                    [item.orden, item.id]
                );
            }
            return { success: true, actualizados: items.length };
        });
    }

    getCategorias(id_categoria: number): Promise<CategoriaFinanciera[]> {
        return this.categoriasFinancierasRepo.find({
            where: { tipo_movimiento_id: id_categoria },
            order: { nombre: 'ASC' }
        });
    }

    async buscarPorRazonSocial(texto: string): Promise<MovimientoFinanciero[]> {
        return this.movimientoFinancieroRepo
            .createQueryBuilder('mf')
            .select('mf.razon_social', 'razon_social')
            .addSelect('mf.rfc', 'rfc')
            .where('mf.razon_social LIKE :texto', { texto: `%${texto}%` })
            .groupBy('mf.rfc')
            .addGroupBy('mf.razon_social')
            .limit(10)
            .getRawMany();
    }

    getRazonSocial(rfc: any): Promise<any[]> {
        return this.movimientoFinancieroRepo
            .createQueryBuilder('m')
            .select('m.razon_social', 'razon_social')
            .where('m.rfc = :rfc', { rfc })
            .groupBy('m.razon_social')
            .getRawMany();
    }

    async buscarConceptosPorRfc(rfc: string, texto: string): Promise<MovimientoFinanciero[]> {
        const query = this.movimientoFinancieroRepo
            .createQueryBuilder('mf')
            .select('mf.concepto', 'concepto')
            .where('mf.rfc = :rfc', { rfc });

        if (texto) {
            query.andWhere('mf.concepto LIKE :texto', { texto: `%${texto}%` });
        }
        return query.groupBy('mf.concepto').limit(10).getRawMany();
    }

    async deleteMovimiento(id: number) {
        return await this.movimientoFinancieroRepo.delete(id);
    }

    async getSaldo(anio: number, mes: number) {
        let where = `YEAR(fecha_factura) = ${anio}`;
        if (mes > 0) {
            where += ` AND MONTH(fecha_factura) = ${mes}`;
        }
        const sql = `
        SELECT 
            SUM(CASE WHEN tipo_movimiento_id = 1 THEN importe_sin_iva ELSE 0 END) AS ingresos,
            SUM(CASE WHEN tipo_movimiento_id = 2 THEN importe_sin_iva ELSE 0 END) AS egresos,
            SUM(CASE WHEN tipo_movimiento_id = 3 THEN importe_sin_iva ELSE 0 END) AS inversiones,
            SUM(CASE 
                WHEN tipo_movimiento_id = 1 THEN importe_sin_iva 
                WHEN tipo_movimiento_id = 2 THEN -importe_sin_iva 
                ELSE 0 
            END) AS saldo
        FROM movimientos_financieros 
        WHERE ${where}
    `;

        //  console.log('SQL getSaldo:', sql); // 👈 aquí lo ves en la consola del backend

        const result = await this.categoriasFinancierasRepo.query(sql);
        return {
            ingresos: result[0].ingresos || 0,
            egresos: result[0].egresos || 0,
            inversiones: result[0].inversiones || 0,
            saldo: result[0].saldo || 0
        };
    }

    getMetodosPago(): Promise<MetodoPago[]> {
        return this.metodosPagoRepository.find({ order: { nombre: 'ASC' } });
    }

    // ========== GUARDAR CON ORDEN + RENOMBRADO POR ID ==========
    async guardaMovimiento(payload: any, files: { [key: string]: Express.Multer.File[] }) {

        // 1. Calcular orden automático del mes
        const [anioStr, mesStr] = (payload.fecha_pago || '').split('-');
        const anio = parseInt(anioStr, 10);
        const mes = parseInt(mesStr, 10);

        let maxOrden = 0;
        if (!isNaN(anio) && !isNaN(mes)) {
            const result = await this.movimientoFinancieroRepo.query(`
                SELECT COALESCE(MAX(orden), 0) as maxOrden 
                FROM movimientos_financieros 
                WHERE YEAR(fecha_pago) = ? AND MONTH(fecha_pago) = ?
            `, [anio, mes]);
            maxOrden = Number(result[0]?.maxOrden || 0);
        }
        payload.orden = maxOrden + 1;

        // 2. Guardar registro para obtener ID
        const movimientoInicial = this.movimientoFinancieroRepo.create(payload);
        const guardado = await this.movimientoFinancieroRepo.save(movimientoInicial) as any;
        const id = guardado.id as number;

        // 3. Renombrar archivos: {id}_{nombre_original}
        const camposArchivo = ['archivo_factura', 'archivo_pago'];
        const nombresFinales: { [key: string]: string } = {};

        for (const campo of camposArchivo) {
            const archivosCampo = files?.[campo];
            if (!archivosCampo || !archivosCampo.length) continue;

            const nombres: string[] = [];
            for (const archivo of archivosCampo) {
                const nombreOriginal = Buffer.from(archivo.originalname, 'latin1').toString('utf8');
                const ext = extname(nombreOriginal);
                const base = basename(nombreOriginal, ext);
                const nuevoNombre = `${id}_${base}${ext}`;

                const rutaVieja = join('./uploads/movimientos', archivo.filename);
                const rutaNueva = join('./uploads/movimientos', nuevoNombre);

                try {
                    renameSync(rutaVieja, rutaNueva);
                    nombres.push(nuevoNombre);
                } catch (err) {
                    console.error(`Error renombrando ${campo}:`, err);
                    nombres.push(archivo.filename);
                }
            }
            nombresFinales[campo] = JSON.stringify(nombres);
        }

        // 4. Actualizar registro con nombres finales
        if (Object.keys(nombresFinales).length > 0) {
            await this.movimientoFinancieroRepo.update(id, nombresFinales);
            Object.assign(guardado, nombresFinales);
        }

        // 5. Caja chica (si aplica)
        if (
            Number(payload.tipo_movimiento_id) === 2 &&
            Number(payload.categoria_id) === 27
        ) {
            const cajaChica = this.movimientoCajaChicaRepo.create({
                fecha: payload.fecha_pago,
                concepto: payload.concepto,
                ingreso: payload.importe_sin_iva,
                gasto: 0,
                capturo: payload.razon_social,
                orden: 0
            });
            await this.movimientoCajaChicaRepo.save(cajaChica);
        }

        return guardado;
    }

    async getMovimiento(id: number) {
        return this.movimientoFinancieroRepo.findOne({ where: { id } });
    }

    async getMovimientosPorCategoria(
        categoriaId: number,
        tipoMovimientoId: number,
        anio?: number,
        mes?: number,
    ) {
        let where = `m.categoria_id = ? AND m.tipo_movimiento_id = ?`;
        const params: any[] = [categoriaId, tipoMovimientoId];

        if (anio) {
            where += ` AND YEAR(m.fecha_factura) = ?`;
            params.push(anio);

            if (mes && mes > 0) {
                where += ` AND MONTH(m.fecha_factura) = ?`;
                params.push(mes);
            }
        }

        const sql = `
        SELECT m.*, mp.nombre AS metodo_pago
        FROM movimientos_financieros m
        LEFT JOIN metodos_pago mp ON mp.id = m.metodo_pago_id
        WHERE ${where}
        ORDER BY m.orden, m.fecha_pago, m.fecha_factura ASC
    `;

        console.log('SQL getMovimientosPorCategoria:', this.armarSqlDebug(sql, params));

        return await this.movimientoFinancieroRepo.query(sql, params);
    }

    // Helper solo para debug - reemplaza los "?" con los valores reales
    private armarSqlDebug(sql: string, params: any[]): string {
        let i = 0;
        return sql.replace(/\?/g, () => {
            const valor = params[i++];
            if (valor === null || valor === undefined) return 'NULL';
            if (typeof valor === 'number') return String(valor);
            return `'${valor}'`; // strings y fechas entre comillas
        });
    }

    async updateOrden(id: number, orden: number): Promise<any> {
        return await this.movimientoFinancieroRepo.query(`
            UPDATE movimientos_financieros SET orden = ? WHERE id = ?
        `, [orden, id]);
    }

    async contarArchivosPorRfcYTipo(rfc: string, campo: string): Promise<number> {
        const rfcLimpio = (rfc || '').toUpperCase();
        const rows = await this.movimientoFinancieroRepo
            .createQueryBuilder('m')
            .select(`m.${campo}`, 'archivo')
            .where('m.rfc = :rfc', { rfc: rfcLimpio })
            .andWhere(`m.${campo} IS NOT NULL AND m.${campo} != ''`)
            .getRawMany();

        let total = 0;
        rows.forEach(r => {
            if (r.archivo) {
                try {
                    const arr = JSON.parse(r.archivo);
                    total += Array.isArray(arr) ? arr.length : 0;
                } catch {
                    // Fallback para registros viejos con coma
                    total += r.archivo.split(',').filter((x: string) => x.trim()).length;
                }
            }
        });
        return total;
    }

    async updateMovimiento(id: number, payload: any, files?: { [key: string]: Express.Multer.File[] }) {
        const movimiento = await this.movimientoFinancieroRepo.findOne({ where: { id } });
        if (!movimiento) {
            throw new Error('Movimiento no encontrado');
        }

        const camposArchivo = ['archivo_factura', 'archivo_pago'];

        for (const campo of camposArchivo) {
            const key = campo.replace('archivo_', '');
            const actualesRaw = payload[`archivos_actuales_${key}`];

            // Archivos que el usuario decidió conservar (vienen como JSON desde el frontend)
            let actuales: string[] = [];
            if (actualesRaw) {
                try {
                    const parsed = JSON.parse(actualesRaw);
                    actuales = Array.isArray(parsed) ? parsed : [];
                } catch {
                    actuales = String(actualesRaw).split(',').map(x => x.trim()).filter(Boolean);
                }
            }

            // Archivos nuevos subidos en esta petición
            const archivosCampo = files?.[campo];
            const nombresNuevos: string[] = [];

            if (archivosCampo && archivosCampo.length) {
                for (const archivo of archivosCampo) {
                    const nombreOriginal = Buffer.from(archivo.originalname, 'latin1').toString('utf8');
                    const ext = extname(nombreOriginal);
                    const base = basename(nombreOriginal, ext);
                    const nuevoNombre = `${id}_${base}${ext}`;

                    const rutaVieja = join('./uploads/movimientos', archivo.filename);
                    const rutaNueva = join('./uploads/movimientos', nuevoNombre);

                    try {
                        renameSync(rutaVieja, rutaNueva);
                        nombresNuevos.push(nuevoNombre);
                    } catch (err) {
                        console.error(`Error renombrando ${campo}:`, err);
                        nombresNuevos.push(archivo.filename);
                    }
                }
            }

            // Combinar los que se conservaron + los nuevos, y guardar como JSON
            const combinados = [...actuales, ...nombresNuevos];
            payload[campo] = JSON.stringify(combinados);

            // Limpiar el campo auxiliar para que no se intente guardar en la tabla
            delete payload[`archivos_actuales_${key}`];
        }

        await this.movimientoFinancieroRepo.update(id, payload);
        return { ok: true };
    }
}