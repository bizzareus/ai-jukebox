import {
  ConflictException,
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

@Injectable()
export class VenuesService {
  private readonly logger = new Logger(VenuesService.name);

  constructor(
    @InjectRepository(Venue)
    private readonly venueRepository: Repository<Venue>,
  ) {}

  async create(dto: CreateVenueDto, ownerId: string): Promise<Venue> {
    const existing = await this.venueRepository.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException('Slug already taken');

    const venue = this.venueRepository.create({
      ...dto,
      ownerId,
      pricePerSong: dto.pricePerSong ?? 100,
    });

    const saved = await this.venueRepository.save(venue);

    const qrCodeUrl = await this.generateQrCode(saved.slug);
    saved.qrCodeUrl = qrCodeUrl;
    const final = await this.venueRepository.save(saved);
    this.logger.log(`Created venue: ${final.name} [${final.slug}]`);
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
    const updates: Partial<Venue> = {};
    if (dto.pricePerSong !== undefined) updates.pricePerSong = dto.pricePerSong;
    if (dto.discountAmount !== undefined) {
      const maxPrice = dto.pricePerSong ?? venue.pricePerSong;
      updates.discountAmount = Math.min(dto.discountAmount, maxPrice);
    }
    if (Object.keys(updates).length > 0) {
      await this.venueRepository.update(id, updates);
      return this.findById(id);
    }
    return venue;
  }

  async refreshQrCode(venueId: string): Promise<Venue> {
    const venue = await this.findById(venueId);
    const qrCodeUrl = await this.generateQrCode(venue.slug);
    return this.update(venueId, { qrCodeUrl });
  }

  private async generateQrCode(slug: string): Promise<string> {
    const appUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';
    const url = `${appUrl}/${slug}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#E11D48', light: '#0F0F0F' },
    });
    return dataUrl;
  }
}
