export interface Env {
  API_KEY: string;
  ALLOWED_ORIGINS?: string;
  RATE_LIMIT_PER_MINUTE?: string;
}

export interface TmwVoucher {
  voucher_id: string;
  amount_baht: string;
  redeemed_amount_baht: string;
  member: number;
  status: string;
  link: string;
  detail: string;
  expire_date: number;
  type: string;
  redeemed: number;
  available: number;
}

export interface TmwOwnerProfile {
  full_name: string;
}

export interface TmwRedeemerProfile {
  mobile_number: string;
}

export interface TmwTicket {
  mobile: string;
  update_date: number;
  amount_baht: string;
  full_name: string;
  profile_pic: string | null;
}

export interface TmwSuccessData {
  voucher: TmwVoucher;
  owner_profile: TmwOwnerProfile;
  redeemer_profile: TmwRedeemerProfile;
  my_ticket: TmwTicket;
  tickets: TmwTicket[];
}

export interface TmwSuccessResponse {
  status: { message: "success"; code: "SUCCESS" };
  data: TmwSuccessData;
}

export interface TmwErrorResponse {
  status: { message: string; code: string };
  data?: unknown;
}

export type TmwApiResponse = TmwSuccessResponse | TmwErrorResponse;

export interface ApiStatus {
  code: string;
  message: string;
}

export interface RedeemSuccessResponse {
  status: ApiStatus;
  data: {
    voucher: {
      voucher_id: string;
      amount_baht: string;
      redeemed_amount_baht: string;
      status: string;
    };
    owner_full_name: string;
    redeemer_mobile: string;
  };
}

export interface ApiErrorResponse {
  status: ApiStatus;
}

export type RedeemResponse = RedeemSuccessResponse | ApiErrorResponse;
