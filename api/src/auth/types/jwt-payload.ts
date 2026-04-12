export type JwtTyp = 'staff' | 'tenant' | 'platform';

export type RequestUser = {
  userId: string;
  typ: JwtTyp;
  renterId?: string;
};
