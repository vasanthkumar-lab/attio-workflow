import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CreatePersonDto, UpdatePersonDto } from './people.dto';
import { PeopleService } from './people.service';

@Controller('people')
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Post() create(@Body() dto: CreatePersonDto) { return this.people.create(dto); }
  @Get() list() { return this.people.list(); }
  @Get(':id') get(@Param('id') id: string) { return this.people.get(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePersonDto) { return this.people.update(id, dto); }
}