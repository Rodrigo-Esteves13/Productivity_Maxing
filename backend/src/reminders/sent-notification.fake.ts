import type { SentNotificationService } from './sent-notification.service';
import type { SentNotificationKind } from './sent-notification.constants';

const KEY_SEPARATOR = '|';

/**
 * Implementacao em memoria do SentNotificationService, so para testes: mesma
 * semantica (claim falha se ja existe, release apaga). Partilhar a mesma
 * instancia entre dois servicos simula um restart com a base de dados intacta.
 */
export class FakeSentNotificationService implements Pick<
  SentNotificationService,
  'claim' | 'markMany' | 'release' | 'claimedUserIds' | 'purgeOlderThan'
> {
  readonly rows = new Set<string>();

  static keyOf(
    userId: string,
    kind: SentNotificationKind,
    periodKey: string,
  ): string {
    return [userId, kind, periodKey].join(KEY_SEPARATOR);
  }

  claim(
    userId: string,
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<boolean> {
    const key = FakeSentNotificationService.keyOf(userId, kind, periodKey);
    if (this.rows.has(key)) return Promise.resolve(false);
    this.rows.add(key);
    return Promise.resolve(true);
  }

  markMany(
    userIds: readonly string[],
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<void> {
    for (const userId of userIds) {
      this.rows.add(FakeSentNotificationService.keyOf(userId, kind, periodKey));
    }
    return Promise.resolve();
  }

  release(
    userId: string,
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<void> {
    this.rows.delete(
      FakeSentNotificationService.keyOf(userId, kind, periodKey),
    );
    return Promise.resolve();
  }

  claimedUserIds(
    userIds: readonly string[],
    kind: SentNotificationKind,
    periodKey: string,
  ): Promise<Set<string>> {
    return Promise.resolve(
      new Set(
        userIds.filter((userId) =>
          this.rows.has(
            FakeSentNotificationService.keyOf(userId, kind, periodKey),
          ),
        ),
      ),
    );
  }

  purgeOlderThan(): Promise<number> {
    return Promise.resolve(0);
  }

  asService(): SentNotificationService {
    return this as unknown as SentNotificationService;
  }
}
