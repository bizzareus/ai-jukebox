import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { QueueItem, QueueItemStatus } from './queue-item.entity';
import { Payment, PaymentStatus } from '../payments/payment.entity';
import { QueueGateway } from './queue.gateway';
import { PlaylistsService } from '../playlists/playlists.service';
import { SongsService } from '../songs/songs.service';
import { Song } from '../songs/song.entity';
import { NotificationsService } from '../notifications/notifications.service';

const AUTO_PLAY_RECENT_HOURS = 2;

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectRepository(QueueItem)
    private readonly queueRepository: Repository<QueueItem>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly queueGateway: QueueGateway,
    private readonly playlistsService: PlaylistsService,
    private readonly songsService: SongsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Called by payment webhook after payment is confirmed */
  async enqueueFromPayment(paymentId: string): Promise<QueueItem> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, status: PaymentStatus.PAID },
    });

    if (!payment) throw new NotFoundException('Paid payment not found');

    const existing = await this.queueRepository.findOne({
      where: { paymentId },
    });
    if (existing) return existing;

    const position = await this.getNextPosition(payment.venueId);

    const item = this.queueRepository.create({
      venueId: payment.venueId,
      songId: payment.songId,
      paymentId: payment.id,
      customerName: payment.customerName,
      customerMobile: payment.customerMobile,
      status: QueueItemStatus.PENDING,
      position,
    });

    const saved = await this.queueRepository.save(item);
    this.logger.log(`Enqueued song at position ${position} for venue ${payment.venueId}`);

    const queue = await this.getVenueQueue(payment.venueId);
    this.queueGateway.emitQueueUpdated(payment.venueId, queue);

    const eta = this.calculateEta(queue, saved.id);
    this.queueGateway.emitQueueConfirmed(payment.razorpayOrderId, {
      queueItem: saved,
      position,
      eta,
    });

    try {
      const song = await this.songsService.findById(payment.songId);
      await this.notificationsService.notifyAdminNewSongQueued(payment.venueId, song.title);
    } catch {
      // ignore
    }

    return saved;
  }

  async getVenueQueue(venueId: string): Promise<QueueItem[]> {
    return this.queueRepository.find({
      where: {
        venueId,
        status: In([QueueItemStatus.PENDING, QueueItemStatus.PLAYING]),
      },
      relations: ['song'],
      order: { position: 'ASC' },
    });
  }

  async getNowPlaying(venueId: string): Promise<QueueItem | null> {
    return this.queueRepository.findOne({
      where: { venueId, status: QueueItemStatus.PLAYING },
      relations: ['song'],
    });
  }

  async markPlaying(itemId: string): Promise<QueueItem> {
    const item = await this.queueRepository.findOne({
      where: { id: itemId },
      relations: ['song', 'payment'],
    });
    if (!item) throw new NotFoundException('Queue item not found');

    item.status = QueueItemStatus.PLAYING;
    const saved = await this.queueRepository.save(item);

    this.queueGateway.emitNowPlaying(item.venueId, { queueItem: saved });
    const queue = await this.getVenueQueue(item.venueId);
    this.queueGateway.emitQueueUpdated(item.venueId, queue);

    if (item.payment?.razorpayOrderId && item.song?.title) {
      try {
        await this.notificationsService.notifyCustomerSongPlaying(
          item.payment.razorpayOrderId,
          item.song.title,
        );
      } catch {
        // ignore
      }
    }

    return saved;
  }

  async markPlayed(itemId: string): Promise<QueueItem> {
    const item = await this.queueRepository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Queue item not found');

    item.status = QueueItemStatus.PLAYED;
    item.playedAt = new Date();
    const saved = await this.queueRepository.save(item);

    const queue = await this.getVenueQueue(item.venueId);
    this.queueGateway.emitQueueUpdated(item.venueId, queue);

    return saved;
  }

  async skip(itemId: string): Promise<QueueItem> {
    const item = await this.queueRepository.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Queue item not found');

    item.status = QueueItemStatus.SKIPPED;
    item.playedAt = new Date();
    const saved = await this.queueRepository.save(item);

    const queue = await this.getVenueQueue(item.venueId);
    this.queueGateway.emitQueueUpdated(item.venueId, queue);

    return saved;
  }

  async advanceQueue(venueId: string): Promise<QueueItem | null> {
    const playing = await this.getNowPlaying(venueId);
    if (playing) await this.markPlayed(playing.id);

    let next = await this.queueRepository.findOne({
      where: { venueId, status: QueueItemStatus.PENDING },
      relations: ['song'],
      order: { position: 'ASC' },
    });

    if (!next) {
      const autoItem = await this.enqueueRandomFromPlaylist(venueId);
      if (autoItem) {
        this.logger.log(`Auto-playing random playlist song for venue ${venueId}: ${autoItem.song?.title ?? autoItem.songId}`);
        return this.markPlaying(autoItem.id);
      }
      this.logger.log(`No more songs in queue for venue ${venueId}`);
      this.queueGateway.emitNowPlaying(venueId, null);
      return null;
    }

    return this.markPlaying(next.id);
  }

  /**
   * When queue is empty: enqueue one random song from the venue's playlists.
   * Prefers songs not played in the last AUTO_PLAY_RECENT_HOURS; if all were
   * played recently, falls back to any song from the playlist.
   * Returns the new queue item or null if venue has no playlist songs.
   */
  async enqueueRandomFromPlaylist(venueId: string): Promise<QueueItem | null> {
    const recentSongIds = await this.getRecentlyPlayedSongIds(venueId, AUTO_PLAY_RECENT_HOURS);
    const playlists = await this.playlistsService.findByVenue(venueId);
    const allSet = new Set<string>();
    const preferredSet = new Set<string>();
    for (const p of playlists) {
      for (const ps of p.playlistSongs ?? []) {
        if (!ps.songId) continue;
        allSet.add(ps.songId);
        if (!recentSongIds.has(ps.songId)) preferredSet.add(ps.songId);
      }
    }
    const candidateSongIds =
      preferredSet.size > 0 ? [...preferredSet] : [...allSet];
    if (candidateSongIds.length === 0) {
      this.logger.log(`No playlist songs for venue ${venueId}`);
      return null;
    }
    const randomIndex = Math.floor(Math.random() * candidateSongIds.length);
    const songId = candidateSongIds[randomIndex];
    const position = await this.getNextPosition(venueId);
    const item = this.queueRepository.create({
      venueId,
      songId,
      customerName: 'System',
      status: QueueItemStatus.PENDING,
      position,
    });
    const saved = await this.queueRepository.save(item) as QueueItem;
    const queue = await this.getVenueQueue(venueId);
    this.queueGateway.emitQueueUpdated(venueId, queue);
    return saved;
  }

  private async getRecentlyPlayedSongIds(venueId: string, withinHours: number): Promise<Set<string>> {
    const since = new Date();
    since.setHours(since.getHours() - withinHours);
    const rows = await this.queueRepository
      .createQueryBuilder('q')
      .select('DISTINCT q.song_id', 'songId')
      .where('q.venue_id = :venueId', { venueId })
      .andWhere('q.status IN (:...statuses)', {
        statuses: [QueueItemStatus.PLAYED, QueueItemStatus.SKIPPED],
      })
      .andWhere('q.played_at >= :since', { since })
      .getRawMany<{ songId: string }>();
    return new Set(rows.map((r) => r.songId));
  }

  async getQueueWithEta(venueId: string) {
    const queue = await this.getVenueQueue(venueId);
    return queue.map((item) => ({
      ...item,
      eta: this.calculateEta(queue, item.id),
    }));
  }

  async getHistory(venueId: string, date?: string) {
    const qb = this.queueRepository
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.song', 'song')
      .leftJoinAndSelect('q.payment', 'payment')
      .where('q.venue_id = :venueId', { venueId })
      .andWhere('q.status IN (:...statuses)', {
        statuses: [QueueItemStatus.PLAYED, QueueItemStatus.SKIPPED],
      });

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('q.played_at BETWEEN :start AND :end', { start, end });
    }

    return qb.orderBy('q.played_at', 'DESC').getMany();
  }

  /** Last N played/skipped items for DJ replay. */
  async getRecentPlays(venueId: string, limit = 10): Promise<QueueItem[]> {
    return this.queueRepository.find({
      where: {
        venueId,
        status: In([QueueItemStatus.PLAYED, QueueItemStatus.SKIPPED]),
      },
      relations: ['song'],
      order: { playedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Replay a song from history. No payment (admin replay, price 0).
   * - immediate: add at front, mark playing (current song if any is marked played).
   * - queue_next: add at end of queue.
   */
  async replay(venueId: string, songId: string, mode: 'immediate' | 'queue_next'): Promise<QueueItem> {
    await this.songsService.findById(songId);

    if (mode === 'queue_next') {
      const position = await this.getNextPosition(venueId);
      const item = this.queueRepository.create({
        venueId,
        songId,
        customerName: 'Replay (admin)',
        status: QueueItemStatus.PENDING,
        position,
      });
      const saved = await this.queueRepository.save(item);
      const queue = await this.getVenueQueue(venueId);
      this.queueGateway.emitQueueUpdated(venueId, queue);
      this.logger.log(`Replay queued: ${songId} at position ${position} for venue ${venueId}`);
      return saved;
    }

    // immediate: add at position 1, shift others up, mark new as playing
    const pending = await this.queueRepository.find({
      where: { venueId, status: QueueItemStatus.PENDING },
      order: { position: 'ASC' },
    });
    for (const p of pending) {
      await this.queueRepository.update(p.id, { position: p.position + 1 });
    }

    const playing = await this.getNowPlaying(venueId);
    if (playing) await this.markPlayed(playing.id);

    const item = this.queueRepository.create({
      venueId,
      songId,
      customerName: 'Replay (admin)',
      status: QueueItemStatus.PLAYING,
      position: 1,
    });
    await this.queueRepository.save(item);
    const saved = await this.queueRepository.findOne({
      where: { id: item.id },
      relations: ['song'],
    });
    if (saved) {
      this.queueGateway.emitNowPlaying(venueId, { queueItem: saved });
    }
    const queue = await this.getVenueQueue(venueId);
    this.queueGateway.emitQueueUpdated(venueId, queue);
    this.logger.log(`Replay immediate: ${songId} for venue ${venueId}`);
    return saved ?? item;
  }

  private async getNextPosition(venueId: string): Promise<number> {
    const result = await this.queueRepository
      .createQueryBuilder('q')
      .select('MAX(q.position)', 'maxPos')
      .where('q.venue_id = :venueId', { venueId })
      .andWhere('q.status IN (:...statuses)', {
        statuses: [QueueItemStatus.PENDING, QueueItemStatus.PLAYING],
      })
      .getRawOne<{ maxPos: number }>();

    return (result?.maxPos ?? 0) + 1;
  }

  private calculateEta(queue: QueueItem[], targetItemId: string): number {
    let eta = 0;
    for (const item of queue) {
      if (item.id === targetItemId) break;
      eta += item.song?.durationSeconds ?? 0;
    }
    return eta;
  }

  /** Most played songs at this venue (by play count from queue history). */
  async getMostPlayedSongs(venueId: string, limit = 20): Promise<{ song: Song; playCount: number }[]> {
    const raw = await this.queueRepository
      .createQueryBuilder('q')
      .select('q.song_id', 'songId')
      .addSelect('COUNT(*)', 'playCount')
      .where('q.venue_id = :venueId', { venueId })
      .andWhere('q.status IN (:...statuses)', {
        statuses: [QueueItemStatus.PLAYED, QueueItemStatus.SKIPPED],
      })
      .groupBy('q.song_id')
      .orderBy('COUNT(*)', 'DESC')
      .limit(limit)
      .getRawMany<{ songId: string; playCount: string }>();
    if (raw.length === 0) return [];
    const songIds = raw.map((r) => r.songId);
    const songs = await this.songsService.findByIds(songIds);
    const byId = new Map(songs.map((s) => [s.id, s]));
    return raw
      .map((r) => ({ song: byId.get(r.songId), playCount: parseInt(r.playCount, 10) }))
      .filter((x): x is { song: Song; playCount: number } => !!x.song);
  }

  /** For order-status API: get queue item and ETA by payment id (when payment is paid). */
  async getQueueItemWithEtaByPaymentId(paymentId: string): Promise<{ id: string; position: number; eta: number } | null> {
    const item = await this.queueRepository.findOne({
      where: { paymentId },
      relations: ['song'],
    });
    if (!item) return null;
    const queue = await this.getVenueQueue(item.venueId);
    const eta = this.calculateEta(queue, item.id);
    return { id: item.id, position: item.position, eta };
  }

  /** Last N distinct customers for a venue (from queue_items). Super admin only. */
  async getRecentCustomers(
    venueId: string,
    limit: number = 50,
  ): Promise<{ customerName: string | null; customerMobile: string | null; lastSeen: string }[]> {
    const rows = await this.queueRepository
      .createQueryBuilder('q')
      .select('q.customer_name', 'customerName')
      .addSelect('q.customer_mobile', 'customerMobile')
      .addSelect('MAX(q.queued_at)', 'lastSeen')
      .where('q.venue_id = :venueId', { venueId })
      .andWhere('(q.customer_name IS NOT NULL OR q.customer_mobile IS NOT NULL)')
      .groupBy('q.customer_name')
      .addGroupBy('q.customer_mobile')
      .orderBy('lastSeen', 'DESC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      customerName: r.customerName ?? null,
      customerMobile: r.customerMobile ?? null,
      lastSeen: r.lastSeen instanceof Date ? r.lastSeen.toISOString() : String(r.lastSeen),
    }));
  }
}
