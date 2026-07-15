import { Controller, Get, Res } from '@nestjs/common';
import { join } from 'path';

@Controller()
export class AppController {
  @Get()
  home(@Res() res: any) {
    return res.sendFile(join(process.cwd(), 'public', 'index.html'));
  }
}
