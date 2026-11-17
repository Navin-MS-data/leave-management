import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AuthUser } from '../common/types';
import { User } from '../entities';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@InjectRepository(User) private users: Repository<User>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET as string,
    });
  }

  /**
   * The user is reloaded on every request, so role changes and deactivation take effect
   * immediately instead of when the token expires.
   */
  async validate(payload: { sub: number }): Promise<AuthUser> {
    const user = await this.users.findOneBy({ id: payload.sub });
    if (!user || !user.active) throw new UnauthorizedException();
    return { id: user.id, name: user.name, email: user.email, role: user.role, managerId: user.managerId };
  }
}
