import { CardUsage } from '../../../../../../shared/domain/entities/CardUsage';

export interface ICardUsageRepository {
  findByDateRange(startDate: Date, endDate: Date): Promise<CardUsage[]>;
  findById(id: string): Promise<CardUsage | null>;
  save(cardUsage: CardUsage): Promise<void>;
  update(id: string, updates: Partial<CardUsage>): Promise<void>;
  delete(id: string): Promise<void>;
}
