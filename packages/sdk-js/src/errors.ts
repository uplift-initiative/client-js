export class UpliftAIError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'UpliftAIError';
  }
}

export class UpliftAIAuthError extends UpliftAIError {
  constructor(message = 'Authentication failed. Check your API key.', requestId?: string) {
    super(message, 401, 'auth_error', requestId);
    this.name = 'UpliftAIAuthError';
  }
}

export class UpliftAIInsufficientBalanceError extends UpliftAIError {
  constructor(message = 'Insufficient balance. Please add credits to your account.', requestId?: string) {
    super(message, 402, 'insufficient_balance', requestId);
    this.name = 'UpliftAIInsufficientBalanceError';
  }
}

export class UpliftAIRateLimitError extends UpliftAIError {
  constructor(message = 'Rate limit exceeded.', requestId?: string) {
    super(message, 429, 'rate_limited', requestId);
    this.name = 'UpliftAIRateLimitError';
  }
}
