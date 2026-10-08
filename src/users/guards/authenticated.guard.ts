import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { UsersService } from '../users.service';

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const rawUserId = request.signedCookies?.userId;
    const userId = rawUserId ? parseInt(rawUserId, 10) : undefined;

    if (!userId || isNaN(userId)) {
      response.redirect('/todos/login');
      return false;
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      // CookieはあるがDBにユーザーが存在しない場合はCookieをクリアしてリダイレクト
      response.clearCookie('userId');
      response.redirect('/todos/login');
      return false;
    }

    // requestオブジェクトに認証済みユーザー情報をセット
    (request as any).user = user;
    return true;
  }
}
