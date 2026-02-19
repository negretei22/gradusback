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

    findMovimientos() {
        return this.movimientoFinancieroRepo.find();
    }

    getCategorias(): Promise<CategoriaFinanciera[]> {
        return this.categoriasFinancierasRepo.find();
    }

    async getSaldo() {
        const result = await this.categoriasFinancierasRepo.query(`
    SELECT 
      SUM(CASE WHEN tipo_movimiento_id = 1 THEN monto ELSE 0 END) AS ingresos,
      SUM(CASE WHEN tipo_movimiento_id = 2 THEN monto ELSE 0 END) AS egresos,
      SUM(CASE WHEN tipo_movimiento_id = 1 THEN monto ELSE -monto END) AS saldo
    FROM movimientos_financieros
  `);

        return {
            ingresos: result[0].ingresos || 0,
            egresos: result[0].egresos || 0,
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


    async getMovimiento(id : number){
        return this.movimientoFinancieroRepo.findOne({ where: { id } });
    }

    async updateMovimiento(id: number, payload: any) {
        //onsole.log(payload)
        await this.movimientoFinancieroRepo.update(id, payload);
        return this.movimientoFinancieroRepo.findOne({ where: { id } });
    }



}
