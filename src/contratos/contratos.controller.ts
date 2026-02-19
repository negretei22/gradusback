import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ContratosService } from './contratos.service';
import { CategoriaContrato } from './categorias_contrato.entity';
import { Estados } from './estados.entity';
import { Municipios } from './municipios.entity';
import { Colonias } from './colonias.entity';
import { EmpresasParticipantes } from './empresas_participantes';
import { Contratantes } from './contratantes.entity';

@Controller('contratos')
export class ContratosController {
  constructor(private readonly contratoService: ContratosService) { }

  @Get()
  findContratos() {
    return this.contratoService.findContratos();
  }

  @Get('categorias')
  findCategorias(): Promise<CategoriaContrato[]> {
    return this.contratoService.findCategorias();
  }

  @Get('estados')
  findEstados(): Promise<Estados[]> {
    return this.contratoService.findEstados();
  }
  
  @Get('contratantes')
  findContratantes(): Promise<Contratantes[]> {
    return this.contratoService.findContratantes();
  }

  @Get('contratante/:id_contratante')
  findInfoContratante(@Param('id_contratante') id_contratante: number): Promise<Contratantes[]> {
    return this.contratoService.findInfoContratante(id_contratante);
  }

  @Get('municipios/:id_estado')
  findMunicipios(@Param('id_estado') id_estado: number): Promise<Municipios[]> {
    return this.contratoService.findMunicipios(id_estado);
  }

  @Get('colonias/:id_municipio/:codigo_postal')
  findColonias(@Param('id_muncipio') id_municipio: number , @Param('codigo_postal') codigo_postal: number): Promise<Colonias[]> {
    return this.contratoService.findColonias(id_municipio,codigo_postal);
  }

  @Get('empresas-participantes')
  findEmpresasParticipantes(): Promise<EmpresasParticipantes[]> {
    return this.contratoService.findEmpresasParticipantes();
  }

  @Post('save')
  async guardaPartida(@Body() payload: any) {
    console.log(payload)
    return await this.contratoService.saveContrato(payload)
  }




}



