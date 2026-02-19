import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { MaquinariaService } from './maquinaria.service';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';

@Controller('maquinaria')
export class MaquinariaController {

  constructor(private readonly maquinariaService: MaquinariaService) { }

  @Get()
  findContratos() {
    return this.maquinariaService.findMaquinaria();
  }

  @Get('marcas')
  getMarcas(): Promise<Marcas[]> {
    return this.maquinariaService.getMarcas();
  }

  @Get('arrendadores')
  getArrendadoresMaquinaria(): Promise<ArrendadoresMaquinaria[]> {
    return this.maquinariaService.getArrendadoresMaquinaria();
  }

  @Get('modelos/:id_marca')
  findMunicipios(@Param('id_marca') id_marca: number): Promise<Modelos[]> {
    return this.maquinariaService.getModelos(id_marca);
  }
  

  @Post('save')
    async guardaPartida(@Body() payload: any) {
      console.log(payload)
      return await this.maquinariaService.saveMaquinaria(payload)
    }
}
