import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TodosModule } from './todos/todos.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { Todo } from './todos/entities/todo.entity';
import { User } from './users/entities/user.entity';
import { Department } from './departments/entities/department.entity';
import * as dotenv from 'dotenv';

dotenv.config();
const onRender = process.env.RENDER === 'true';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Todo, User, Department],
      ssl: onRender,                        // Render(+Neon)のときだけSSL
      synchronize: !onRender,               // Render以外は今まで通り自動生成
      migrations: [__dirname + '/migrations/*.js'],
      migrationsRun: onRender,              // Renderのときだけ起動時にマイグレーション適用
    }),
    TodosModule,
    UsersModule,
    DepartmentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

