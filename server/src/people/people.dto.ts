import { IsArray, IsEmail, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreatePersonDto {
  @IsEmail() email: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsInt() @Min(0) companySize?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEmail() owner?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}

export class UpdatePersonDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() industry?: string;
  @IsOptional() @IsInt() @Min(0) companySize?: number;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsEmail() owner?: string;
  @IsOptional() @IsString() stage?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) tags?: string[];
}