import {
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as QRCode from 'qrcode';
import { Venue } from './venue.entity';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    @InjectRepository(Venue)
    private readonly venueRepository: Repository<Venue>,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {}

  /** Generate a URL-safe slug from venue name and ensure uniqueness. */
  private async uniqueSlugFromName(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'venue';
    let slug = base;
    let n = 0;
    while (true) {
      const existing = await this.venueRepository.findOne({
        where: { slug },
      });
      if (!existing) return slug;
      n += 1;
      slug = `${base}-${n}`;
    }
  }

  /**
   * Create a venue from an invite (GTM flow). Used when a bar registers via invite link.
   * Owner is the super admin who sent the invite. Caller then creates the venue admin.
   */
  async createFromInvite(
    venueName: string,
    ownerId: string,
    _address?: string,
  ): Promise<Venue> {
    const slug = await this.uniqueSlugFromName(venueName);
    const defaultUpi = process.env.INVITE_DEFAULT_UPI_VPA || 'pending@venue';
    const venue = this.venueRepository.create({
      name: venueName,
      slug,
      upiVpa: defaultUpi,
      ownerId,
      pricePerSong: 100,
    });
    const saved = await this.venueRepository.save(venue);
    const qrCodeUrl = await this.generateQrCode(saved.slug);
    saved.qrCodeUrl = qrCodeUrl;
    const final = await this.venueRepository.save(saved);
    this.logger.log(`Created venue from invite: ${final.name} [${final.slug}]`);
    return final;
  }

  async create(dto: CreateVenueDto, ownerId: string): Promise<Venue> {
    const existing = await this.venueRepository.findOne({
      where: { slug: dto.slug },
    });
    if (existing) throw new ConflictException('Slug already taken');

    const venue = this.venueRepository.create({
      name: dto.name,
      slug: dto.slug,
      upiVpa: dto.upiVpa,
      ownerId,
      pricePerSong: dto.pricePerSong ?? 100,
    });

    const saved = await this.venueRepository.save(venue);

    const qrCodeUrl = await this.generateQrCode(saved.slug);
    saved.qrCodeUrl = qrCodeUrl;
    const final = await this.venueRepository.save(saved);

    await this.authService.createVenueAdmin(
      final.id,
      dto.adminEmail,
      dto.adminPassword,
      dto.adminName ?? `${dto.name} Admin`,
    );

    this.logger.log(
      `Created venue: ${final.name} [${final.slug}] with admin ${dto.adminEmail}`,
    );
    return final;
  }

  async findBySlug(slug: string): Promise<Venue> {
    const venue = await this.venueRepository.findOne({ where: { slug } });
    if (!venue) throw new NotFoundException('Venue not found');
    return venue;
  }

  async findById(id: string): Promise<Venue> {
    const venue = await this.venueRepository.findOne({ where: { id } });
    if (!venue) throw new NotFoundException('Venue not found');
    return venue;
  }

  async findByOwner(ownerId: string): Promise<Venue[]> {
    return this.venueRepository.find({ where: { ownerId } });
  }

  async update(id: string, dto: UpdateVenueDto): Promise<Venue> {
    const venue = await this.findById(id);
    if (dto.slug !== undefined && dto.slug !== venue.slug) {
      const existing = await this.venueRepository.findOne({
        where: { slug: dto.slug },
      });
      if (existing) throw new ConflictException('Slug already taken');
    }
    const updates: Partial<
      Pick<
        Venue,
        'name' | 'slug' | 'upiVpa' | 'pricePerSong' | 'discountAmount'
      >
    > & {
      settings?: Record<string, unknown>;
    } = {};
    if (dto.name !== undefined) updates.name = dto.name;
    if (dto.slug !== undefined) updates.slug = dto.slug;
    if (dto.upiVpa !== undefined) updates.upiVpa = dto.upiVpa;
    if (dto.pricePerSong !== undefined) updates.pricePerSong = dto.pricePerSong;
    if (dto.discountAmount !== undefined) {
      const maxPrice = dto.pricePerSong ?? venue.pricePerSong;
      updates.discountAmount = Math.min(dto.discountAmount, maxPrice);
    }
    if (dto.logoUrl !== undefined) {
      updates.settings = { ...(venue.settings ?? {}), logoUrl: dto.logoUrl };
    }
    if (Object.keys(updates).length > 0) {
      await this.venueRepository.update(id, updates as Record<string, unknown>);
      const updated = await this.findById(id);
      if (updates.slug !== undefined) {
        const qrCodeUrl = await this.generateQrCode(updated.slug);
        await this.venueRepository.update(id, { qrCodeUrl });
        return this.findById(id);
      }
      return updated;
    }
    return venue;
  }

  async addAdminToVenue(
    venueId: string,
    email: string,
    password: string,
    name?: string,
  ) {
    await this.findById(venueId);
    return this.authService.createVenueAdmin(
      venueId,
      email,
      password,
      name ?? 'Venue Admin',
    );
  }

  async refreshQrCode(venueId: string): Promise<Venue> {
    const venue = await this.findById(venueId);
    const qrCodeUrl = await this.generateQrCode(venue.slug);
    await this.venueRepository.update(venueId, { qrCodeUrl });
    return this.findById(venueId);
  }

  private async generateQrCode(slug: string): Promise<string> {
    const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const url = `${appUrl}/${slug}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return dataUrl;
  }
}
