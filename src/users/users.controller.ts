import {
  Controller,
  Get,
  Post,
  Body,
  Render,
  Res,
  Req,
  HttpStatus,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import * as express from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { RegisterValidationFilter } from './register-validation.filter';
import { DepartmentsService } from '../departments/departments.service';
import { AuthenticatedGuard } from './guards/authenticated.guard';
import { User } from './entities/user.entity';

const AUTH_COOKIE_NAME = 'userId';
const COOKIE_OPTIONS: express.CookieOptions = {
  httpOnly: true,
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7日間有効
  sameSite: 'lax',
};

@Controller("/todos")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly departmentsService: DepartmentsService,
  ) {}

  @Get('register')
  @Render('register')
  async showRegisterPage() {
    const departments = await this.departmentsService.findAll();
    return { error: null, values: {}, departments };
  }

  @Post('register')
  @UseFilters(RegisterValidationFilter)
  async register(
    @Body() createUserDto: CreateUserDto,
    @Res() res: express.Response,
    @Req() req: express.Request,
  ) {
    try {
      const user = await this.usersService.create(createUserDto);

      // 部署の設定
      const rawDeptIds = (req.body as any).departmentIds;
      if (rawDeptIds) {
        const deptIds: number[] = (
          Array.isArray(rawDeptIds) ? rawDeptIds : [rawDeptIds]
        ).map(Number).filter((n: number) => !isNaN(n));
        const depts = await this.departmentsService.findByIds(deptIds);
        await this.usersService.setDepartments(user.id, depts);
      }

      // 登録成功時に自動ログインCookieを付与
      res.cookie(AUTH_COOKIE_NAME, String(user.id), COOKIE_OPTIONS);
      return res.redirect('/todos');
    } catch (error: any) {
      const departments = await this.departmentsService.findAll();
      const message =
        error?.response?.message ||
        error?.message ||
        'ユーザー登録に失敗しました。';
      return res.status(HttpStatus.BAD_REQUEST).render('register', {
        error: Array.isArray(message) ? message.join('、') : message,
        values: {
          email: createUserDto.email || '',
          username: createUserDto.username || '',
        },
        departments,
      });
    }
  }

  @Get('login')
  @Render('login')
  showLoginPage() {
    return { error: null, values: {} };
  }

  @Post('login')
  async login(
    @Body() loginUserDto: LoginUserDto,
    @Res() res: express.Response,
  ) {
    const user = await this.usersService.validateUser(
      loginUserDto.email,
      loginUserDto.password,
    );

    if (!user) {
      return res.status(HttpStatus.UNAUTHORIZED).render('login', {
        error: 'メールアドレスまたはパスワードが正しくありません。',
        values: {
          email: loginUserDto.email || '',
        },
      });
    }

    // ログイン成功: Cookieに署名付きでuserIdを保存
    res.cookie(AUTH_COOKIE_NAME, String(user.id), COOKIE_OPTIONS);
    return res.redirect('/todos');
  }

  @Get('logout')
  logout(@Res() res: express.Response) {
    res.clearCookie(AUTH_COOKIE_NAME);
    return res.redirect('/todos/login');
  }

  // ---- プロフィールページ ----

  @Get('profile')
  @UseGuards(AuthenticatedGuard)
  @Render('profile')
  async showProfilePage(@Req() req: express.Request) {
    const user = (req as any).user as User;
    const userWithDepts = await this.usersService.findByIdWithDepartments(user.id);
    const allDepartments = await this.departmentsService.findAll();
    const userDeptIds = (userWithDepts?.departments ?? []).map((d) => d.id);
    return {
      currentUser: user,
      userDeptIds,
      allDepartments,
      success: null,
      error: null,
    };
  }

  @Post('profile')
  @UseGuards(AuthenticatedGuard)
  async updateProfile(
    @Req() req: express.Request,
    @Res() res: express.Response,
  ) {
    const user = (req as any).user as User;
    const rawDeptIds = (req.body as any).departmentIds;

    const deptIds: number[] = rawDeptIds
      ? (Array.isArray(rawDeptIds) ? rawDeptIds : [rawDeptIds])
          .map(Number)
          .filter((n: number) => !isNaN(n))
      : [];

    const depts = await this.departmentsService.findByIds(deptIds);
    await this.usersService.setDepartments(user.id, depts);

    const allDepartments = await this.departmentsService.findAll();
    const userDeptIds = depts.map((d) => d.id);
    return res.render('profile', {
      currentUser: user,
      userDeptIds,
      allDepartments,
      success: '所属部署を更新しました。',
      error: null,
    });
  }
}

