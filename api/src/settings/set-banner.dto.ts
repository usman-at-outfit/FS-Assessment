import { IsArray, IsString, IsNotEmpty, ArrayMaxSize } from 'class-validator';

export class SetBannersDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  images: string[];
}
