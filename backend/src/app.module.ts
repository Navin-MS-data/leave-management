import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { AuthModule } from './auth/auth.module';
import { BalancesModule } from './balances/balances.module';
import { CalendarModule } from './calendar/calendar.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard, RolesGuard } from './common/guards';
import { buildDataSourceOptions } from './database/database.config';
import { ALL_ENTITIES } from './entities';
import { HolidaysModule } from './holidays/holidays.module';
import { LeaveRequestsModule } from './leave-requests/leave-requests.module';
import { LeaveTypesModule } from './leave-types/leave-types.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

export type DataSourceFactory = (options?: DataSourceOptions) => Promise<DataSource>;

@Module({})
export class AppModule {
  /**
   * `dataSourceFactory` lets tests supply their own (in-memory) database.
   * Production uses the Postgres connection described by the environment.
   */
  static register(dataSourceFactory?: DataSourceFactory): DynamicModule {
    return {
      module: AppModule,
      imports: [
        TypeOrmModule.forRootAsync({
          useFactory: () =>
            dataSourceFactory
              ? ({ type: 'postgres', entities: ALL_ENTITIES } as DataSourceOptions)
              : buildDataSourceOptions(),
          dataSourceFactory: dataSourceFactory ?? (async (options) => new DataSource(options!).initialize()),
        }),
        CommonModule,
        AuthModule,
        UsersModule,
        LeaveTypesModule,
        HolidaysModule,
        SettingsModule,
        LeaveRequestsModule,
        BalancesModule,
        CalendarModule,
      ],
      providers: [
        // Order matters: authenticate first, then check roles.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    };
  }
}
