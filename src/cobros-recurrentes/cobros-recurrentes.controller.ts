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
import { CobrosRecurrentesService } from './cobros-recurrentes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../shared/enums/user-role.enum';

@Controller('cobros-recurrentes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CobrosRecurrentesController {
  constructor(private readonly cobrosService: CobrosRecurrentesService) {}

  // NOTA: estas dos rutas van ANTES de ':id' o Nest las tragaría como id.
  @Get('reporte/:anio/:mes')
  reporte(
    @Param('anio', ParseIntPipe) anio: number,
    @Param('mes', ParseIntPipe) mes: number,
  ) {
    return this.cobrosService.reporte(anio, mes);
  }

  @Get('buscar-facturas')
  buscarFacturas(@Query('texto') texto = '') {
    return this.cobrosService.buscarFacturas(texto);
  }

  @Get()
  findAll() {
    return this.cobrosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cobrosService.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  create(@Body() payload: any) {
    return this.cobrosService.create(payload);
  }

  @Put('seleccion')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setSeleccion(@Body() payload: any) {
    return this.cobrosService.setSeleccion(payload);
  }

  @Put('seleccion-mes')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setSeleccionMes(@Body() payload: any) {
    return this.cobrosService.setSeleccionMes(payload);
  }

  @Put(':id/pagado')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  setCobrado(@Param('id', ParseIntPipe) id: number, @Body() payload: any) {
    return this.cobrosService.setCobrado(id, payload);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() payload: any) {
    return this.cobrosService.update(id, payload);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cobrosService.remove(id);
  }
}
