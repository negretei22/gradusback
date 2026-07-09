import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm/repository/Repository';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';
import * as fs from 'fs';
import { join, extname } from 'path';


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
        private metodosPagoRepository: Repository<MetodoPago>

    ) { }

    findMovimientos(anio?: string, mes?: string) {

        let where = '';

        if (anio && mes) {
            if (mes == '0')
                where = `WHERE YEAR(m.fecha_pago) = ${anio}`;
            else
                where = `WHERE YEAR(m.fecha_pago) = ${anio} AND MONTH(m.fecha_pago) = ${mes}`;
        }

        return this.movimientoFinancieroRepo.query(`
    SELECT 
      m.*,
      mp.nombre AS metodo_pago
    FROM movimientos_financieros m
    LEFT JOIN metodos_pago mp ON mp.id = m.metodo_pago_id
    ${where}
    ORDER BY m.fecha_pago,m.id ASC
  `);
    }

    getCategorias(id_categoria: number): Promise<CategoriaFinanciera[]> {
        return this.categoriasFinancierasRepo.find({
            where: { tipo_movimiento_id: id_categoria }
        });
    }

    getRazonSocial(rfc: any): Promise<any[]> {
        return this.movimientoFinancieroRepo
            .createQueryBuilder('m')
            .select('m.razon_social', 'razon_social')
            .where('m.rfc = :rfc', { rfc })
            .groupBy('m.razon_social')
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
      SUM(CASE WHEN tipo_movimiento_id = 1 THEN importe_sin_iva ELSE -importe_sin_iva END) AS saldo
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
        return this.metodosPagoRepository.find();
    }

    async guardaMovimiento(payload: any) {

        const contrato = this.movimientoFinancieroRepo.create(payload);
        return await this.movimientoFinancieroRepo.save(contrato);
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

    async updateMovimiento(id: number, payload: any) {

        const movimiento = await this.movimientoFinancieroRepo.findOne({ where: { id } });

        if (!movimiento) {
            throw new Error('Movimiento no encontrado');
        }

        const camposArchivo = [
            'archivo_prefactura', 'archivo_factura',
            'archivo_nota_pago', 'archivo_pago', 'archivo_otra'
        ];

        const folioNuevo = (payload.folio_fiscal || 'SIN_FOLIO').replace(/[^a-zA-Z0-9-_]/g, '');

        camposArchivo.forEach(campo => {

            const archivoViejo = (movimiento as any)[campo];

            if (payload[campo]) {
                // Caso 1: subieron un archivo NUEVO en este campo -> borra el viejo si existía
                if (archivoViejo) {
                    const path = `uploads/movimientos/${archivoViejo}`;
                    if (fs.existsSync(path)) {
                        fs.unlinkSync(path);
                    }
                }
            } else if (archivoViejo) {
                // Caso 2: NO subieron archivo nuevo, pero ya existe uno -> intenta renombrarlo con el folio actualizado
                const ext = extname(archivoViejo);
                const label = LABELS_MAP[campo];
                const nuevoNombre = `${folioNuevo} - ${label}${ext}`;

                if (nuevoNombre !== archivoViejo) {
                    const rutaVieja = join('./uploads/movimientos', archivoViejo);
                    const rutaNueva = join('./uploads/movimientos', nuevoNombre);

                    try {
                        if (fs.existsSync(rutaVieja)) {
                            fs.renameSync(rutaVieja, rutaNueva);
                            payload[campo] = nuevoNombre; // actualiza el nombre para guardar en BD
                        }
                    } catch (err) {
                        console.error(`Error renombrando ${campo}:`, err);
                        payload[campo] = archivoViejo; // fallback: deja el nombre viejo
                    }
                } else {
                    payload[campo] = archivoViejo; // el nombre no cambió, no hace falta tocarlo
                }
            }
        });

        await this.movimientoFinancieroRepo.update(id, payload);

        return { ok: true };
    }



}
