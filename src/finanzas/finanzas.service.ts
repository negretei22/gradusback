import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm/repository/Repository';
import { MovimientoFinanciero } from './movimientos_financieros.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { CategoriaFinanciera } from './categorias_financieras.entity';
import { MetodoPago } from './metodos_pago.entity';

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
                where = `WHERE YEAR(m.fecha_factura) = ${anio}`;
            else
                where = `WHERE YEAR(m.fecha_factura) = ${anio} AND MONTH(m.fecha_factura) = ${mes}`;
        }

        return this.movimientoFinancieroRepo.query(`
    SELECT 
      m.*,
      mp.nombre AS metodo_pago
    FROM movimientos_financieros m
    LEFT JOIN metodos_pago mp ON mp.id = m.metodo_pago_id
    ${where}
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

    

    async getSaldo(anio: number, mes: number) {

        let where = `YEAR(fecha_factura) = ${anio}`;

        if (mes>0) {
            where += ` AND MONTH(fecha_factura) = ${mes}`;
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

    async updateMovimiento(id: number, payload: any) {
        console.log(payload)
        await this.movimientoFinancieroRepo.update(id, payload);
        return this.movimientoFinancieroRepo.findOne({ where: { id } });
    }



}
