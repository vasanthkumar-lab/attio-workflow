import { ArrayNotEmpty, IsArray, IsBoolean, IsString } from 'class-validator';

export class EnrollDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) personIds: string[];
}

export class SetEnabledDto {
  @IsBoolean() enabled: boolean;
}