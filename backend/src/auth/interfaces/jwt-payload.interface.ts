export interface JwtPayload {
  sub: string; // User.id (uuid)
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface LinkStatePayload {
  sub: string;
  purpose: 'link';
  provider: string;
  iat?: number;
  exp?: number;
}
