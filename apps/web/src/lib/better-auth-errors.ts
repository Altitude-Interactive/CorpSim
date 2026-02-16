type SearchParamsLike = {
  get: (key: string) => string | null;
};

const ERROR_MESSAGES: Record<string, string> = {
  "email_doesn't_match": "Cannot link account: the email address from this provider doesn't match your current account email.",
  account_not_linked: "Cannot link account: account linking is not enabled for this provider.",
  account_already_linked: "This account is already linked to your profile.",
  account_already_linked_to_different_user: "This account is linked to a different user. Please unlink it there first.",
  linking_failed: "Failed to link account. Please try again."
};

export function resolveBetterAuthErrorMessage(error: string, description?: string | null): string {
  return ERROR_MESSAGES[error] || description || `Authentication failed: ${error}`;
}

export function readBetterAuthErrorFromParams(params: SearchParamsLike): { error: string; description?: string | null } | null {
  const error = params.get("error");
  if (!error) {
    return null;
  }
  return {
    error,
    description: params.get("error_description")
  };
}
