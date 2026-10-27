import {
  Controller, Get, Post, Delete, Param, Query, Req, Body,
  UploadedFile, UseInterceptors, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConciliacionService } from './conciliacion.service';

@Controller('conciliacion')
export class ConciliacionController {
  constructor(private readonly service: ConciliacionService) { }

  private usuario(req: any): string | null {
    return req.user?.username ?? req.user?.email ?? req.user?.nombre ?? null;
  }

  @Get(':anio/:mes')
  cargar(@Param('anio') anio: number, @Param('mes') mes: number) {
    return this.service.cargar(anio, mes);
  }

  @Post('pdf')
  @UseInterceptors(FileInterceptor('archivo'))
  conciliar(
    @UploadedFile() file: Express.Multer.File,
    @Query('reemplazar') reemplazar: string,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Falta el archivo');
    return this.service.conciliar(file.buffer, file.originalname, reemplazar === '1', this.usuario(req));
  }

  @Post(':id/unir')
  unir(@Param('id') id: number, @Body() body: any, @Req() req: any) {
    return this.service.unir(id, body.banco_ids, body.sistema_ids, body.comentario ?? null, this.usuario(req));
  }

  @Delete('grupo/:id')
  quitarUnion(
    @Param('id') id: number,
    @Req() req: any
  ) {
    return this.service.quitarUnion(
      Number(id),
      this.usuario(req)
    );
  }

  @Post(':id/nota')
  agregarNota(@Param('id') id: number, @Body() body: any, @Req() req: any) {
    return this.service.agregarNota(id, body.lado, body.ref_id, body.comentario, this.usuario(req));
  }

  @Delete('nota/:id')
  quitarNota(@Param('id') id: number) {
    return this.service.quitarNota(id);
  }
}