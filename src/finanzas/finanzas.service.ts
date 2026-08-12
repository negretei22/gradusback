import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm/repository/Repository';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import { MovimientoCajaChica } from 'src/caja-chica/movimientos_caja_chica.entity';
import * as fs from 'fs';
import { join, extname } from 'path';
import { Like } from 'typeorm';


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
            if (mes == '0')
                where = `WHERE YEAR(m.fecha_pago) = ${anio}`;
            else
                where = `WHERE YEAR(m.fecha_pago) = ${anio} AND MONTH(m.fecha_pago) = ${mes}`;
        }

        const result = await this.movimientoFinancieroRepo.query(`
    SELECT 
      m.*,
      mp.nombre AS metodo_pago
    FROM movimientos_financieros m
    LEFT JOIN metodos_pago mp ON mp.id = m.metodo_pago_id
    ${where}
    ORDER BY m.orden,m.fecha_pago,m.fecha_factura ASC
  `);
       // console.log(result)
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
            order: {
                nombre: 'ASC'
            }
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

        return query
            .groupBy('mf.concepto')
            .limit(10)
            .getRawMany();
    }


    async deleteMovimiento(id: number) {

        return await this.movimientoFinancieroRepo.delete(id);

    }


    async getSaldo(anio: number, mes: number) {

        let where = `YEAR(fecha_pago) = ${anio}`;

        if (mes > 0) {
            where += ` AND MONTH(fecha_pago) = ${mes}`;
        }

        //console.log(where)
        const result = await this.categoriasFinancierasRepo.query(`
    SELECT 
      SUM(CASE WHEN tipo_movimiento_id = 1 THEN importe_sin_iva ELSE 0 END) AS ingresos,
      SUM(CASE WHEN tipo_movimiento_id = 2 THEN importe_sin_iva ELSE 0 END) AS egresos,
      SUM(CASE WHEN tipo_movimiento_id = 3 THEN importe_sin_iva ELSE 0 END) AS inversiones,
      SUM(CASE 
      WHEN tipo_movimiento_id = 1 THEN importe_sin_iva 
      WHEN tipo_movimiento_id = 2 THEN -importe_sin_iva 
      ELSE 0 
    END) AS saldo
    FROM movimientos_financieros where ${where}
  `);

        return {
            ingresos: result[0].ingresos || 0,
            egresos: result[0].egresos || 0,
            inversiones: result[0].inversiones || 0,
            saldo: result[0].saldo || 0
        };
    }

    getMetodosPago(): Promise<MetodoPago[]> {
        return this.metodosPagoRepository.find({
            order: {
                nombre: 'ASC'
            }
        });
    }

    async guardaMovimiento(payload: any) {

        const movimiento = this.movimientoFinancieroRepo.create(payload);
        const resultado = await this.movimientoFinancieroRepo.save(movimiento);

        if (
            Number(payload.tipo_movimiento_id) === 2 &&
            Number(payload.categoria_id) === 27
        ) {

            const cajaChica = this.movimientoCajaChicaRepo.create({
                fecha: payload.fecha_pago,
                concepto: payload.concepto,
                ingreso: payload.importe_sin_iva,      // o el campo correspondiente
                gasto: 0,
                capturo: payload.razon_social,
                orden: 0
            });

            await this.movimientoCajaChicaRepo.save(cajaChica);
        }

        return resultado;
    }


    async getMovimiento(id: number) {
        return this.movimientoFinancieroRepo.findOne({ where: { id } });
    }


    async updateOrden(id: number, orden: number): Promise<any> {

        return await this.movimientoFinancieroRepo.query(`
    UPDATE movimientos_financieros
    SET orden = ?
    WHERE id = ?
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
                total += r.archivo.split(',').filter((x: string) => x.trim()).length;
            }
        });

        return total;
    }

    async updateMovimiento(id: number, payload: any) {

        const movimiento = await this.movimientoFinancieroRepo.findOne({ where: { id } });

        if (!movimiento) {
            throw new Error('Movimiento no encontrado');
        }

        // Quita los campos "archivos_actuales_*" que no existen en la entidad
        Object.keys(LABELS_MAP).forEach(campoArchivo => {
            // campoArchivo es "archivo_factura", "archivo_pago", etc.
            const key = campoArchivo.replace('archivo_', ''); // "factura", "pago", etc.
            delete payload[`archivos_actuales_${key}`];
        });

        const camposArchivo = [
            'archivo_prefactura', 'archivo_factura',
            'archivo_nota_pago', 'archivo_pago', 'archivo_otra'
        ];

        const folioNuevo = (payload.folio_fiscal || 'SIN_FOLIO').replace(/[^a-zA-Z0-9-_]/g, '');

        camposArchivo.forEach(campo => {
            // ... el resto de tu lógica actual sigue exactamente igual
        });

        await this.movimientoFinancieroRepo.update(id, payload);

        return { ok: true };
    }



}
