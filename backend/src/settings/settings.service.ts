import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Setting } from '../entities';

export interface AppSettings {
  minNoticeDays: number;
  maxTeamOffPerDay: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  minNoticeDays: 2,
  maxTeamOffPerDay: 2,
};

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Setting) private repo: Repository<Setting>) {}

  /** Reads the settings, falling back to defaults for anything not configured yet. */
  async getAll(manager?: EntityManager): Promise<AppSettings> {
    const rows = await (manager ?? this.repo.manager).find(Setting);
    const result: AppSettings = { ...DEFAULT_SETTINGS };
    for (const row of rows) {
      if (row.key in result) {
        const n = Number(row.value);
        if (Number.isInteger(n)) (result as unknown as Record<string, number>)[row.key] = n;
      }
    }
    return result;
  }

  async update(patch: Partial<AppSettings>): Promise<AppSettings> {
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || !(key in DEFAULT_SETTINGS)) continue;
      await this.repo.save({ key, value: String(value) });
    }
    return this.getAll();
  }
}
