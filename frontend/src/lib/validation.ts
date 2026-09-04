export interface RegistrationForm {
  full_name: string;
  email: string;
  password: string;
  organization_name: string;
}

export type RegistrationErrors = Partial<Record<keyof RegistrationForm, string>>;

const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function validateEmail(email: string): string | null {
  if (!email) return "Email is required.";
  if (!EMAIL_RE.test(email)) return "Enter a valid email address.";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/\d/.test(password)) return "Password must include at least one number.";
  if (!/[A-Z]/.test(password)) return "Password must include at least one uppercase letter.";
  return null;
}

export function validateRegistration(form: RegistrationForm): RegistrationErrors {
  const errors: RegistrationErrors = {};
  if (form.full_name.trim().length < 2) errors.full_name = "Please enter your full name.";
  const emailError = validateEmail(form.email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(form.password);
  if (passwordError) errors.password = passwordError;
  if (form.organization_name.trim().length < 2) errors.organization_name = "Enter your company or organization name.";
  return errors;
}
