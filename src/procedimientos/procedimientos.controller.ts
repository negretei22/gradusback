import { Controller, Get } from '@nestjs/common';
import { ProcedimientosService } from './procedimientos.service';

@Controller('procedimientos')
export class ProcedimientosController {
    constructor(private procedimientoService: ProcedimientosService) { }


    @Get()
    getProcedimientos() {
        return this.procedimientoService.findAll();

    }

}



