import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Admin)
    private readonly adminRepository: Repository<Admin>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.adminRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already in use');
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

  async login(dto: LoginDto) {
    const admin = await this.adminRepository.findOne({ where: { email: dto.email } });
    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Admin logged in: ${admin.email}`);
    return this.buildTokenResponse(admin);
  }

  async me(adminId: string) {
    return this.adminRepository.findOne({ where: { id: adminId }, relations: ['venue'] });
  }

  async createVenueAdmin(venueId: string, email: string, password: string, name: string) {
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
    const admin = await this.adminRepository.findOne({ where: { id: adminId } });
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

  private buildTokenResponse(admin: Admin) {
    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    const accessToken = this.jwtService.sign(payload);
    const { passwordHash: _, ...adminData } = admin;
    return { accessToken, admin: adminData };
  }
}
