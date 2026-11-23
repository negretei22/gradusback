import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PagosRecurrentesService } from './pagos-recurrentes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../shared/enums/user-role.enum';

@Controller('pagos-recurrentes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PagosRecurrentesController {
  constructor(private readonly pagosService: PagosRecurrentesService) {}

  // NOTA: estas dos rutas van ANTES de ':id' o Nest las tragaría como id.
  @Get('reporte/:anio/:mes')
  reporte(
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
  ) {
    return this.pagosService.reporte(anio, mes);
  }

  @Get('buscar-facturas')
  buscarFacturas(@Query('texto') texto = '') {
    return this.pagosService.buscarFacturas(texto);
  }

  @Get()
  findAll() {
    return this.pagosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pagosService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(@Body() payload: any) {
    return this.pagosService.create(payload);
  }

  @Put('seleccion')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setSeleccion(@Body() payload: any) {
    return this.pagosService.setSeleccion(payload);
  }

  @Put('seleccion-mes')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setSeleccionMes(@Body() payload: any) {
    return this.pagosService.setSeleccionMes(payload);
  }

  @Put(':id/pagado')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setPagado(@Param('id', ParseIntPipe) id: number, @Body() payload: any) {
    return this.pagosService.setPagado(id, payload);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() payload: any) {
    return this.pagosService.update(id, payload);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pagosService.remove(id);
  }
}
