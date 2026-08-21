export type AccessTokenClaims = {
  sub: string;
  type: "access";
  ver: number;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
};

export type VerifiedAccessToken = {
  adminId: number;
  tokenVersion: number;
  jti: string;
};

export type AdminAuthProfile = {
  id: number;
  name: string;
  email: string;
};

export type LoginResult = {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
  admin: AdminAuthProfile;
};

export type LoginSuccess = LoginResult & {
  sessionId: string;
  refreshToken: string;
};

export type RefreshSessionRecord = {
  adminId: number;
  tokenVersion: number;
  refreshTokenHash: string;
  createdAt: string;
};

export type RefreshRotationResult = {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
  sessionId: string;
  refreshToken: string;
};
