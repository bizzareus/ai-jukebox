import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Admin, AdminRole } from './admin.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { InviteTokenService } from '../gtm/invite-token.service';
import { VenuesService } from '../venues/venues.service';
import { LoginLinkTokenService } from './login-link-token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly jwtService: JwtService,
    private readonly inviteTokenService: InviteTokenService,
    @Inject(forwardRef(() => VenuesService))
    private readonly venuesService: VenuesService,
    private readonly loginLinkTokenService: LoginLinkTokenService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.adminRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    if (dto.invite) {
      return this.registerWithInvite(dto);
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const admin = this.adminRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      venueId: dto.venueId,
    });

    const saved = await this.adminRepository.save(admin);
    this.logger.log(`Registered admin: ${saved.email}`);
    return this.buildTokenResponse(saved);
  }

  private async registerWithInvite(dto: RegisterDto) {
    const payload = this.inviteTokenService.verify(dto.invite!);
    if (!payload) {
      throw new BadRequestException(
        'Invalid or expired invite link. Please request a new one.',
      );
    }
    if (payload.email.toLowerCase() !== dto.email.toLowerCase()) {
      throw new BadRequestException(
        'This invite link is for a different email address.',
      );
    }
    const venue = await this.venuesService.createFromInvite(
      payload.venueName,
      payload.createdByAdminId,
      payload.address,
    );
    const admin = await this.createVenueAdmin(
      venue.id,
      dto.email,
      dto.password,
      dto.name,
    );
    this.logger.log(
      `Registered admin via invite: ${admin.email} for venue ${venue.name} [${venue.slug}]`,
    );
    return this.buildTokenResponse(admin);
  }

  async login(dto: LoginDto) {
    const admin = await this.adminRepository.findOne({
      where: { email: dto.email },
    });
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Admin logged in: ${admin.email}`);
    return this.buildTokenResponse(admin);
  }

  async me(adminId: string) {
    return this.adminRepository.findOne({
      where: { id: adminId },
      relations: ['venue'],
    });
  }

  async createVenueAdmin(
    venueId: string,
    email: string,
    password: string,
    name: string,
  ) {
    const existing = await this.adminRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const admin = this.adminRepository.create({
      email,
      passwordHash,
      name,
      role: AdminRole.VENUE_ADMIN,
      venueId,
    });
    const saved = await this.adminRepository.save(admin);
    this.logger.log(`Created venue admin: ${saved.email} for venue ${venueId}`);
    return saved;
  }

  async changePassword(adminId: string, dto: ChangePasswordDto) {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }
    const match = await bcrypt.compare(dto.currentPassword, admin.passwordHash);
    if (!match) {
      throw new BadRequestException('Current password is incorrect');
    }
    admin.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.adminRepository.save(admin);
    this.logger.log(`Password changed for admin: ${admin.email}`);
  }

  /** List venue admins (no password). Super admin only. */
  async findByVenueId(venueId: string): Promise<Omit<Admin, 'passwordHash'>[]> {
    const admins = await this.adminRepository.find({
      where: { venueId },
      order: { createdAt: 'ASC' },
    });
    return admins.map(({ passwordHash: _, ...a }) => a);
  }

  /** Set password for a venue admin. Super admin only. */
  async setAdminPassword(adminId: string, newPassword: string): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.role !== AdminRole.VENUE_ADMIN) {
      throw new ForbiddenException('Can only reset password for venue admins');
    }
    admin.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.adminRepository.save(admin);
    this.logger.log(`Password reset for venue admin: ${admin.email}`);
  }

  /** Delete a venue admin. Super admin only. Cannot delete super_admins. */
  async deleteVenueAdmin(adminId: string): Promise<void> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.role === AdminRole.SUPER_ADMIN) {
      throw new ForbiddenException('Cannot delete a super admin');
    }
    await this.adminRepository.remove(admin);
    this.logger.log(`Deleted venue admin: ${admin.email}`);
  }

  /** Return the first super admin id (for GTM onboard fallback owner). */
  async findFirstSuperAdminId(): Promise<string | null> {
    const admin = await this.adminRepository.findOne({
      where: { role: AdminRole.SUPER_ADMIN },
      order: { createdAt: 'ASC' },
    });
    return admin?.id ?? null;
  }

  /** Generate a presigned login link for a venue admin. Super admin only. */
  async createLoginLink(adminId: string): Promise<{ loginLink: string }> {
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
    });
    if (!admin) throw new NotFoundException('Admin not found');
    if (admin.role !== AdminRole.VENUE_ADMIN) {
      throw new ForbiddenException(
        'Login links can only be created for venue admins',
      );
    }
    const token = this.loginLinkTokenService.sign(admin.id);
    const baseUrl = process.env.FRONTEND_URL || 'https://muzobox.com';
    const loginLink = `${baseUrl}/admin/login?token=${encodeURIComponent(token)}`;
    this.logger.log(`Login link created for venue admin ${admin.email}`);
    return { loginLink };
  }

  /** Exchange a login-link token for a session. Only for venue admins. */
  async loginWithToken(token: string) {
    const adminId = this.loginLinkTokenService.verify(token);
    if (!adminId) {
      throw new UnauthorizedException(
        'Invalid or expired login link. Request a new one.',
      );
    }
    const admin = await this.adminRepository.findOne({
      where: { id: adminId },
      relations: ['venue'],
    });
    if (!admin) {
      throw new UnauthorizedException('Invalid or expired login link.');
    }
    if (admin.role !== AdminRole.VENUE_ADMIN) {
      throw new ForbiddenException(
        'This link cannot be used for super admins.',
      );
    }
    this.logger.log(`Login via link: ${admin.email}`);
    return this.buildTokenResponse(admin);
  }

  private buildTokenResponse(admin: Admin) {
    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    const accessToken = this.jwtService.sign(payload);
    const { passwordHash: _, ...adminData } = admin;
    return { accessToken, admin: adminData };
  }
}
