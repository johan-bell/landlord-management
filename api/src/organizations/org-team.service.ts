import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { OrgRole } from '@prisma/client';
import type { RequestUser } from '../auth/types/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function tokenBytes(): string {
  return randomBytes(24).toString('base64url');
}

@Injectable()
export class OrgTeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  private async memberOrThrow(orgId: string, userId: string) {
    const m = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (!m) {
      throw new ForbiddenException('You are not a member of this organization');
    }
    return m;
  }

  /** Platform operators bypass membership; staff must be org members. */
  private async ensureOrgActor(orgId: string, actor: RequestUser) {
    if (actor.typ === 'platform') {
      await this.organizationsService.findOneOrThrow(orgId);
      return { isPlatform: true as const, member: null };
    }
    if (actor.typ !== 'staff') {
      throw new ForbiddenException();
    }
    const member = await this.memberOrThrow(orgId, actor.userId);
    return { isPlatform: false as const, member };
  }

  /** OWNER or MANAGER, or platform admin. */
  async assertTeamManagerOrPlatform(orgId: string, actor: RequestUser) {
    await this.ensureTeamManagerActor(orgId, actor);
  }

  /** Any org member (staff), or platform — for org-scoped reads/actions that are not team-admin-only. */
  async assertOrganizationAccess(orgId: string, actor: RequestUser) {
    await this.ensureOrgActor(orgId, actor);
  }

  private async ensureTeamManagerActor(orgId: string, actor: RequestUser) {
    const ctx = await this.ensureOrgActor(orgId, actor);
    if (!ctx.isPlatform) {
      if (
        ctx.member.role !== OrgRole.OWNER &&
        ctx.member.role !== OrgRole.MANAGER
      ) {
        throw new ForbiddenException('Owner or manager role required');
      }
    }
    return ctx;
  }

  /** OWNER or MANAGER, or platform admin (tenant signups, etc.). */
  async assertTeamManager(orgId: string, userId: string) {
    const m = await this.memberOrThrow(orgId, userId);
    if (m.role !== OrgRole.OWNER && m.role !== OrgRole.MANAGER) {
      throw new ForbiddenException('Owner or manager role required');
    }
    return m;
  }

  async assertOwner(orgId: string, userId: string) {
    const m = await this.memberOrThrow(orgId, userId);
    if (m.role !== OrgRole.OWNER) {
      throw new ForbiddenException('Owner role required');
    }
    return m;
  }

  async listMembers(orgId: string, actor: RequestUser) {
    await this.ensureOrgActor(orgId, actor);
    return this.prisma.organizationMember.findMany({
      where: { organizationId: orgId },
      include: {
        user: { select: { id: true, email: true, name: true, phone: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateMemberRole(
    orgId: string,
    memberId: string,
    actor: RequestUser,
    newRole: OrgRole,
  ) {
    const ctx = await this.ensureTeamManagerActor(orgId, actor);
    const actorMember = ctx.member;

    const target = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
      include: { user: true },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }

    if (!ctx.isPlatform && actorMember) {
      if (newRole === OrgRole.OWNER && actorMember.role !== OrgRole.OWNER) {
        throw new ForbiddenException('Only an owner can assign the owner role');
      }
      if (target.role === OrgRole.OWNER && actorMember.role !== OrgRole.OWNER) {
        throw new ForbiddenException('Only an owner can change another owner');
      }
    }

    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: newRole },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
  }

  async removeMember(orgId: string, memberId: string, actor: RequestUser) {
    const ctx = await this.ensureTeamManagerActor(orgId, actor);
    const actorMember = ctx.member;

    const target = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: orgId },
    });
    if (!target) {
      throw new NotFoundException('Member not found');
    }
    if (!ctx.isPlatform && target.userId === actor.userId) {
      throw new BadRequestException('You cannot remove yourself');
    }
    if (!ctx.isPlatform && actorMember) {
      if (target.role === OrgRole.OWNER && actorMember.role !== OrgRole.OWNER) {
        throw new ForbiddenException('Only an owner can remove another owner');
      }
    }

    const owners = await this.prisma.organizationMember.count({
      where: { organizationId: orgId, role: OrgRole.OWNER },
    });
    if (target.role === OrgRole.OWNER && owners <= 1 && !ctx.isPlatform) {
      throw new BadRequestException('Cannot remove the last owner');
    }

    return this.prisma.organizationMember.delete({ where: { id: memberId } });
  }

  async listInvitations(orgId: string, actor: RequestUser) {
    await this.ensureTeamManagerActor(orgId, actor);
    return this.prisma.organizationInvitation.findMany({
      where: { organizationId: orgId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createInvitation(
    orgId: string,
    actor: RequestUser,
    email: string,
    role: OrgRole,
  ) {
    const ctx = await this.ensureTeamManagerActor(orgId, actor);
    const actorMember = ctx.member;

    if (!ctx.isPlatform && actorMember) {
      if (role === OrgRole.OWNER && actorMember.role !== OrgRole.OWNER) {
        throw new ForbiddenException(
          'Only an owner can invite with owner role',
        );
      }
    }

    const normalized = email.toLowerCase().trim();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalized },
    });
    if (existingUser) {
      const already = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: existingUser.id,
            organizationId: orgId,
          },
        },
      });
      if (already) {
        throw new ConflictException('User is already a member');
      }
    }

    await this.prisma.organizationInvitation.deleteMany({
      where: { organizationId: orgId, email: normalized },
    });

    const token = tokenBytes();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    return this.prisma.organizationInvitation.create({
      data: {
        organizationId: orgId,
        email: normalized,
        role,
        token,
        expiresAt,
        createdByUserId: actor.userId,
      },
    });
  }

  async deleteInvitation(
    orgId: string,
    invitationId: string,
    actor: RequestUser,
  ) {
    await this.ensureTeamManagerActor(orgId, actor);
    const inv = await this.prisma.organizationInvitation.findFirst({
      where: { id: invitationId, organizationId: orgId },
    });
    if (!inv) {
      throw new NotFoundException('Invitation not found');
    }
    return this.prisma.organizationInvitation.delete({
      where: { id: invitationId },
    });
  }

  async previewInvitation(token: string) {
    const inv = await this.prisma.organizationInvitation.findUnique({
      where: { token },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!inv || inv.expiresAt < new Date()) {
      throw new NotFoundException('Invalid or expired invitation');
    }
    return {
      organizationId: inv.organizationId,
      organizationName: inv.organization.name,
      email: inv.email,
      role: inv.role,
    };
  }

  async acceptInvitation(token: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.email) {
      throw new NotFoundException('User not found');
    }
    const inv = await this.prisma.organizationInvitation.findUnique({
      where: { token },
      include: { organization: true },
    });
    if (!inv || inv.expiresAt < new Date()) {
      throw new NotFoundException('Invalid or expired invitation');
    }
    if (user.email.toLowerCase() !== inv.email) {
      throw new ForbiddenException('Sign in with the invited email address');
    }

    const existing = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: inv.organizationId },
      },
    });
    if (existing) {
      await this.prisma.organizationInvitation
        .delete({ where: { id: inv.id } })
        .catch(() => undefined);
      throw new ConflictException(
        'You are already a member of this organization',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.organizationMember.create({
        data: {
          userId,
          organizationId: inv.organizationId,
          role: inv.role,
        },
      });
      await tx.organizationInvitation.delete({ where: { id: inv.id } });
    });

    return { organizationId: inv.organizationId, role: inv.role };
  }
}
