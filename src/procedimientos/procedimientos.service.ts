import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Procedimiento } from './procedimientos.entity';

@Injectable()
export class ProcedimientosService {

    constructor(
        @InjectRepository(Procedimiento)
        private repo: Repository<Procedimiento>
    ) { }

    async findAll() {

        const data = await this.repo.find();

        return data.map(p => ({

            proc: p.numero_procedimiento,
            estado: p.estado,
            desc: p.descripcion,
            visita: p.fecha_visita,
            aclar: p.fecha_aclaraciones,
            apertura: p.fecha_apertura,
            fallo: p.fecha_fallo

        }));

    }

}