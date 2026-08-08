import { Body, Controller, Get, Param, Post, Put, Delete, ParseIntPipe } from '@nestjs/common';
import { MaquinariaService } from './maquinaria.service';
import { Marcas } from './marcas.entity';
import { Modelos } from './modelos.entity';
import { ArrendadoresMaquinaria } from './arrendadores_maquinaria.entity';
import { UseInterceptors, UploadedFiles } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';

const storageMaquinaria = diskStorage({
  destination: (req, file, callback) => {
    // También arregla numero_serie si viene con acentos
    const numeroSerieRaw = req.body?.numero_serie || 'sin-serie';
    const numeroSerie = Buffer.from(numeroSerieRaw, 'latin1').toString('utf8');
    
    const ruta = `./uploads/activos/${numeroSerie}`;

    if (!fs.existsSync(ruta)) {
      fs.mkdirSync(ruta, { recursive: true });
    }

    callback(null, ruta);
  },
  filename: (req, file, callback) => {
    // 🔧 FIX: Re-decodifica el nombre del archivo de Latin-1 → UTF-8
    const nombreCorrecto = Buffer.from(file.originalname, 'latin1').toString('utf8');
    callback(null, nombreCorrecto);
  }
});


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
  @UseInterceptors(FilesInterceptor('archivo_documento', 10, { storage: storageMaquinaria }))
  async guardaPartida(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() payload: any
  ) {
    if (files && files.length) {
      payload.documentos = files.map(f => f.filename).join(',');
    }
    console.log(payload);
    return await this.maquinariaService.saveMaquinaria(payload);
  }

  @Put('update')
  @UseInterceptors(FilesInterceptor('archivo_documento', 10, { storage: storageMaquinaria }))
  async actualizaPartida(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() payload: any
  ) {
    if (files && files.length) {
      const nuevos = files.map(f => f.filename).join(',');
      // conserva los documentos que ya existían + agrega los nuevos
      payload.documentos = payload.documentos
        ? `${payload.documentos},${nuevos}`
        : nuevos;
    }
    console.log(payload);
    console.log('PAYLOAD FINAL:', payload);
    return await this.maquinariaService.updateMaquinaria(payload);
  }

  @Delete('delete/:id')
  async eliminaPartida(@Param('id', ParseIntPipe) id: number) {
    console.log(id)
    return await this.maquinariaService.deleteMaquinaria(id)
  }
}
