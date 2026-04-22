import { NextResponse } from 'next/server';
import {
  ApplicationService,
  ApplicationServiceArgs,
} from '@/core/arch/ApplicationService';
import { DomainError } from '@/core/arch/DomainError';

export class ArchResponse {
  static async handleJsonResponse<TArgs extends ApplicationServiceArgs>(
    appService: ApplicationService,
    args: TArgs
  ): Promise<NextResponse> {
    try {
      const result = await appService.exec(args);
      return NextResponse.json(result, { status: 200 });
    } catch (e) {
      if (e instanceof DomainError) {
        return NextResponse.json(
          {
            code: e.getCode(),
            args: e.getArgs(),
          },
          {
            status: 400,
          }
        );
      }

      return NextResponse.json(
        {
          message: (e as { message: string }).message,
        },
        {
          status: 500,
        }
      );
    }
  }

  static async handleHtmlResponse<TArgs extends ApplicationServiceArgs>(
    appService: ApplicationService,
    args: TArgs
  ): Promise<NextResponse> {
    try {
      const response = await appService.exec(args);
      let html: string = '';
      if (response?.html) {
        html = response.html as string;
      }

      return new NextResponse(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    } catch (e) {
      if (e instanceof DomainError) {
        return NextResponse.json(
          {
            code: e.getCode(),
            args: e.getArgs(),
          },
          {
            status: 400,
          }
        );
      }

      return NextResponse.json(
        {
          message: (e as { message: string }).message,
        },
        {
          status: 500,
        }
      );
    }
  }
}
