const THAI_MOBILE_PATTERN = /^0[0-9]{9}$/;
const VOUCHER_CODE_PATTERN = /^[a-zA-Z0-9]{18,50}$/;

export function isValidThaiMobile(mobile: string): boolean {
  return THAI_MOBILE_PATTERN.test(mobile);
}

export function isValidVoucherCode(code: string): boolean {
  return VOUCHER_CODE_PATTERN.test(code);
}
